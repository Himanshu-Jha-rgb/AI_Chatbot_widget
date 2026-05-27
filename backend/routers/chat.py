from fastapi import APIRouter, Depends, Request
from models.schemas import ChatRequest, ChatResponse, Source
from core.auth import verify_api_key, db, limiter
from services.vector_search import search_chunks
from services.embedder import openai_client

router = APIRouter(tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("60/minute")
async def chat(request: Request, req: ChatRequest, current_tenant: dict = Depends(verify_api_key)):
    tenant_id = current_tenant["tenant_id"]
    domain = current_tenant["domain"]
    
    # Vector Search
    chunks = await search_chunks(tenant_id, req.query)
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
            
    system_prompt = f"""You are a helpful assistant for {domain}. Answer only from the provided context. 
The user is currently on page: {req.current_url} titled {req.current_page_title}. 
Context: {context_text}"""

    # Retrieve conversation history
    session = await db.conversations.find_one({"session_id": req.session_id})
    messages = session["messages"] if session else []
    
    messages.append({"role": "user", "content": req.query})
    
    # We shouldn't send the entire unbounded history to OpenAI to avoid token limits,
    # but for simplicity we send it. In production, we'd slice it.
    api_messages = [{"role": "system", "content": system_prompt}] + messages
    
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=api_messages
    )
    answer = response.choices[0].message.content
    
    messages.append({"role": "assistant", "content": answer})
    
    await db.conversations.update_one(
        {"session_id": req.session_id},
        {"$set": {"tenant_id": tenant_id, "current_url": req.current_url, "messages": messages}},
        upsert=True
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
