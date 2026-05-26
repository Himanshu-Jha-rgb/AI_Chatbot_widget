from core.auth import db
from services.embedder import embed_text

async def search_chunks(tenant_id: str, query: str, threshold: float = 0.75, top_k: int = 5):
    query_vector = await embed_text(query)
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(top_k * 10, 100),
                "limit": top_k,
                "filter": {"tenant_id": tenant_id}
            }
        },
        {
            "$addFields": {
                "score": {"$meta": "vectorSearchScore"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "url": 1,
                "title": 1,
                "score": 1
            }
        }
    ]
    
    results = await db.chunks.aggregate(pipeline).to_list(length=top_k)
    return [r for r in results if r.get("score", 0) >= threshold]
