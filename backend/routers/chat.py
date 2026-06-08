from fastapi import APIRouter, Depends, Request, Response, HTTPException
from models.schemas import ChatRequest, ChatResponse, Source
from core.auth import verify_api_key, db, limiter
from core.config import settings
from services.vector_search import search_chunks
from services.embedder import openai_client
import uuid
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

router = APIRouter(tags=["chat"])

@router.get("/widget/config")
async def get_widget_config(current_tenant: dict = Depends(verify_api_key)):
    return {
        "theme": current_tenant.get("theme", "default")
    }

# Max messages to send to GPT-4o (2 per turn = 10 turns of conversation)
MAX_HISTORY = 20
MAX_QUERY_LENGTH = 500
PER_TENANT_RATE_LIMIT = 100
PER_SESSION_RATE_LIMIT = 20
RATE_WINDOW_SECONDS = 60

# In-memory sliding window rate limiters (reset on server restart)
_tenant_limits: dict[str, deque] = defaultdict(deque)
_session_limits: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(key: str, limits: dict, max_reqs: int) -> bool:
    now = time.time()
    window_start = now - RATE_WINDOW_SECONDS
    dq = limits[key]
    while dq and dq[0] < window_start:
        dq.popleft()
    if len(dq) >= max_reqs:
        return False
    dq.append(now)
    return True


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("60/minute")
async def chat(request: Request, req: ChatRequest, fastapi_response: Response, current_tenant: dict = Depends(verify_api_key)):
    tenant_id = current_tenant["tenant_id"]
    domain = current_tenant["domain"]

    # --- Max query length ---
    if len(req.query) > MAX_QUERY_LENGTH:
        raise HTTPException(status_code=400, detail="Query too long.")

    # --- Per-tenant rate limit (catches distributed attacks on a single key) ---
    if not _check_rate_limit(tenant_id, _tenant_limits, PER_TENANT_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    # --- Cookie-based session resolution ---
    now = datetime.now(timezone.utc)
    session_id = request.cookies.get("chat_session_id") or req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())

    # --- Per-session rate limit (catches a single abusive user) ---
    if not _check_rate_limit(session_id, _session_limits, PER_SESSION_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    fastapi_response.set_cookie(
        key="chat_session_id",
        value=session_id,
        max_age=31536000,  # 1 year
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )

    # --- Upsert visitor document ---
    try:
        client_ip = request.client.host if request.client else request.headers.get("x-forwarded-for", "0.0.0.0").split(",")[0].strip()
        visitor = await db.visitors.find_one({"session_id": session_id}, {"ip_history": {"$slice": -1}, "page_views": {"$slice": -1}})

        needs_ip = not visitor or not visitor.get("ip_history") or visitor["ip_history"][-1]["ip"] != client_ip
        needs_page = not visitor or not visitor.get("page_views") or visitor["page_views"][-1]["url"] != req.current_url or visitor["page_views"][-1]["title"] != req.current_page_title

        update = {"$set": {"last_seen_at": now, "tenant_id": tenant_id}}
        if not visitor:
            update["$setOnInsert"] = {
                "session_id": session_id,
                "first_seen_at": now,
                "conversation_ids": [],
                "total_messages": 0,
            }
        if needs_ip:
            update.setdefault("$push", {})["ip_history"] = {
                "$each": [{"ip": client_ip, "seen_at": now}],
                "$slice": -20,
            }
        if needs_page:
            update.setdefault("$push", {})["page_views"] = {
                "$each": [{"url": req.current_url, "title": req.current_page_title, "timestamp": now}],
                "$slice": -50,
            }

        if update:
            await db.visitors.update_one({"session_id": session_id}, update, upsert=True)
    except Exception:
        pass  # Visitor tracking must never break the chat
    # --- end session resolution ---

    # Rewrite query and classify (greeting vs searchable vs out-of-scope)
    search_query, needs_search, is_out_of_scope = await _rewrite_search_query(req.query)

    if is_out_of_scope:
        answer = f"I'm here to answer questions about {domain}. I don't have information about that."
        return ChatResponse(answer=answer, sources=[])

    if needs_search:
        chunks = await search_chunks(tenant_id, search_query)
    else:
        chunks = []

    # Retrieve conversation history
    session = await db.conversations.find_one({"session_id": session_id})
    messages = session["messages"] if session else []

    # If no relevant content found and it's not a greeting, don't let the model hallucinate
    if needs_search and not chunks:
        messages.append({"role": "user", "content": req.query})
        no_context_prompt = f"""You are a representative of {domain} — always speak as "we" and "our", never as "{domain}" or a third party. You do not have any information to answer the user's question, so do not make up content and do not answer unrelated questions. Respond in the same language the user wrote in. However, if the user is asking about pricing, demo, purchasing, or wants to be contacted, offer to help and at the end of your response append [ENQUIRY_FORM]. Otherwise, politely say you don't have that information."""
        api_messages = [{"role": "system", "content": no_context_prompt}] + messages[-MAX_HISTORY:]
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=api_messages
        )
        answer = response.choices[0].message.content
        show_form = "[ENQUIRY_FORM]" in answer
        if show_form:
            answer = answer.replace("[ENQUIRY_FORM]", "").strip()
        messages.append({"role": "assistant", "content": answer})
        await db.conversations.update_one(
            {"session_id": session_id},
            {"$set": {"tenant_id": tenant_id, "current_url": req.current_url, "messages": messages}},
            upsert=True
        )
        await db.visitors.update_one(
            {"session_id": session_id},
            {"$addToSet": {"conversation_ids": session_id},
             "$inc": {"total_messages": 1}}
        )
        return ChatResponse(answer=answer, sources=[], show_enquiry_form=show_form)

    context_text = "\n\n".join([
        _format_context_chunk(c)
        for c in chunks
    ])

    # Sources list
    sources = []
    seen_sources = set()
    for c in chunks:
        section_title = c.get("section_title")
        section_path = c.get("section_path")
        source_key = (c["url"], section_path or section_title or "")
        if source_key not in seen_sources:
            sources.append(Source(
                url=c["url"],
                title=c.get("title") or "Relevant Page",
                section_title=section_title,
                section_path=section_path,
            ))
            seen_sources.add(source_key)

    if not needs_search:
        system_prompt = f"You are a representative of {domain}. Respond conversationally to the user using 'we' and 'our', never referring to yourself as a third party. Do not answer questions unrelated to {domain}. Respond in the same language the user wrote in. If the user asks about pricing, demo, purchasing, or wants to be contacted, offer to help and at the end of your response append [ENQUIRY_FORM]."
    else:
        system_prompt = f"""You are a representative of {domain} — always speak as "we" and "our", never as "{domain}" or a third party. Answer the user's question based on the provided context. Do not make up information that isn't in the context.
The user is currently on page: {req.current_url} titled {req.current_page_title}.
Context: {context_text}
Respond in the same language the user wrote in.
If the user asks about pricing, demo, purchasing, or wants to be contacted, offer to help and at the end of your response append [ENQUIRY_FORM]."""

    messages.append({"role": "user", "content": req.query})

    # Send only the last MAX_HISTORY messages to control token usage.
    # Full history is still stored in MongoDB (see update below).
    api_messages = [{"role": "system", "content": system_prompt}] + messages[-MAX_HISTORY:]

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=api_messages
    )
    answer = response.choices[0].message.content

    # Detect and strip enquiry form marker
    show_form = "[ENQUIRY_FORM]" in answer
    if show_form:
        answer = answer.replace("[ENQUIRY_FORM]", "").strip()

    messages.append({"role": "assistant", "content": answer})

    await db.conversations.update_one(
        {"session_id": session_id},
        {"$set": {"tenant_id": tenant_id, "current_url": req.current_url, "messages": messages}},
        upsert=True
    )

    # Track conversation and message count on visitor
    await db.visitors.update_one(
        {"session_id": session_id},
        {"$addToSet": {"conversation_ids": session_id},
         "$inc": {"total_messages": 1}}
    )

    return ChatResponse(answer=answer, sources=sources, show_enquiry_form=show_form)

def _format_context_chunk(chunk: dict) -> str:
    title = chunk.get("title") or "Relevant Page"
    section = chunk.get("section_path") or chunk.get("section_title")
    heading = f"Source ({chunk['url']})"
    if section:
        heading = f"{heading} - {title} - {section}"
    elif title:
        heading = f"{heading} - {title}"

    return f"{heading}:\n{chunk['text']}"


# Simple in-memory cache for query rewrites (cleared on server restart)
_query_rewrite_cache: dict[str, tuple[str, bool, bool]] = {}

_QUERY_REWRITE_SYSTEM_PROMPT = (
    "You are a query classifier for a company website chatbot. "
    "All website content is in English. "
    "Classify the user's input and respond in this exact format:\n\n"
    "If it's a greeting, thankyou, small talk, or chitchat → respond: GREETING\n"
    "If the user is asking about something completely unrelated to the company, "
    "its products, services, or the website content — like famous people, weather, "
    "general knowledge, jokes, external topics → respond: OUT_OF_SCOPE\n"
    "Vague queries that could be about the company are NOT out of scope.\n"
    "Otherwise → first translate the user's question to English (if not already in English), "
    "then rewrite it into a concise English search query that would match relevant website content. "
    "Extract the core nouns and key concepts in English. "
    "Respond with ONLY the rewritten English query — no preamble, no explanation, no quotes."
)


async def _rewrite_search_query(query: str) -> tuple[str, bool, bool]:
    """Returns (search_query, needs_search, is_out_of_scope).
    Greetings → needs_search=False, is_out_of_scope=False.
    Out-of-scope → needs_search=False, is_out_of_scope=True.
    Searchable → needs_search=True, is_out_of_scope=False.
    """
    q = query.strip()
    if len(q) < 4:
        return q, False, False

    # Check cache
    cached = _query_rewrite_cache.get(q)
    if cached is not None:
        return cached

    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _QUERY_REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": q},
            ],
            max_tokens=60,
            temperature=0.0,
        )
        response_text = resp.choices[0].message.content.strip()

        if response_text == "GREETING":
            result = (q, False, False)
        elif response_text == "OUT_OF_SCOPE":
            result = (q, False, True)
        else:
            rewritten = response_text
            # Sanity check: don't use if it's empty or absurdly long
            if not rewritten or len(rewritten) > 200:
                rewritten = q
            result = (rewritten, True, False)

        # Cache the result
        _query_rewrite_cache[q] = result
        return result
    except Exception:
        # If the LLM call fails, fall back to the original query and treat as searchable
        return q, True, False
