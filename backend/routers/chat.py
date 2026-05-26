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
    context_text = "\n\n".join([f"Source ({c['url']}):\n{c['text']}" for c in chunks])
    
    # Sources list
    sources = []
    seen_urls = set()
    for c in chunks:
        if c['url'] not in seen_urls:
            sources.append(Source(url=c['url'], title="Relevant Page"))
            seen_urls.add(c['url'])
            
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
