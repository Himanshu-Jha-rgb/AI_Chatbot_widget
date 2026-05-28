from fastapi import APIRouter, Depends, Request, Response
from models.schemas import ChatRequest, ChatResponse, Source
from core.auth import verify_api_key, db, limiter
from core.config import settings
from services.vector_search import search_chunks
from services.embedder import openai_client
import uuid
from datetime import datetime, timezone

router = APIRouter(tags=["chat"])

# Max messages to send to GPT-4o (2 per turn = 10 turns of conversation)
MAX_HISTORY = 20

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("60/minute")
async def chat(request: Request, req: ChatRequest, fastapi_response: Response, current_tenant: dict = Depends(verify_api_key)):
    tenant_id = current_tenant["tenant_id"]
    domain = current_tenant["domain"]

    # --- Cookie-based session resolution ---
    now = datetime.now(timezone.utc)
    session_id = request.cookies.get("chat_session_id") or req.session_id
    if not session_id:
        session_id = str(uuid.uuid4())

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

    # Rewrite query and classify (greeting vs searchable)
    search_query, needs_search = await _rewrite_search_query(req.query)

    if needs_search:
        chunks = await search_chunks(tenant_id, search_query)
    else:
        chunks = []

    # Retrieve conversation history
    session = await db.conversations.find_one({"session_id": session_id})
    messages = session["messages"] if session else []

    # If no relevant content found and it's not a greeting, don't let the model hallucinate
    if needs_search and not chunks:
        answer = "I don't have information about that on this site."
        messages.append({"role": "user", "content": req.query})
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
        return ChatResponse(answer=answer, sources=[])

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
        system_prompt = f"You are a representative of {domain}. Respond conversationally to the user using 'we' and 'our', never referring to yourself as a third party."
    else:
        system_prompt = f"""You are a representative of {domain} — always speak as "we" and "our", never as "{domain}" or a third party. Answer only from the provided context.
The user is currently on page: {req.current_url} titled {req.current_page_title}.
Context: {context_text}"""

    messages.append({"role": "user", "content": req.query})

    # Send only the last MAX_HISTORY messages to control token usage.
    # Full history is still stored in MongoDB (see update below).
    api_messages = [{"role": "system", "content": system_prompt}] + messages[-MAX_HISTORY:]

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=api_messages
    )
    answer = response.choices[0].message.content

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

    return ChatResponse(answer=answer, sources=sources)

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
_query_rewrite_cache: dict[str, tuple[str, bool]] = {}

_QUERY_REWRITE_SYSTEM_PROMPT = (
    "You are a search query optimizer for a website RAG system. "
    "Classify the user's input and respond in this exact format:\n\n"
    "If it's a greeting, thankyou, small talk, or chitchat → respond: GREETING\n"
    "Otherwise → rewrite the user's question into a concise search query that would match "
    "relevant website content. Extract the core nouns and key concepts. "
    "Respond with ONLY the rewritten query — no preamble, no explanation, no quotes."
)


async def _rewrite_search_query(query: str) -> tuple[str, bool]:
    """Returns (search_query, needs_search). Greetings/small talk get needs_search=False."""
    q = query.strip()
    if len(q) < 4:
        return q, False

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
            result = (q, False)
        else:
            rewritten = response_text
            # Sanity check: don't use if it's empty or absurdly long
            if not rewritten or len(rewritten) > 200:
                rewritten = q
            result = (rewritten, True)

        # Cache the result
        _query_rewrite_cache[q] = result
        return result
    except Exception:
        # If the LLM call fails, fall back to the original query and treat as searchable
        return q, True
