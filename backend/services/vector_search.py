from core.auth import db
from services.embedder import embed_text
from services.tokens import count_tokens

MAX_PARENT_CONTEXT_TOKENS = 1600
CHILD_CONTEXT_RADIUS = 1

async def search_chunks(tenant_id: str, query: str, threshold: float = 0.75, top_k: int = 5):
    query_vector = await embed_text(query)
    child_limit = max(top_k * 3, top_k)
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(child_limit * 10, 100),
                "limit": child_limit,
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
                "parent_id": 1,
                "section_title": 1,
                "section_path": 1,
                "chunk_index": 1,
                "parent_index": 1,
                "child_index": 1,
                "token_count": 1,
                "score": 1
            }
        }
    ]
    
    child_results = await db.chunks.aggregate(pipeline).to_list(length=child_limit)
    child_results = [r for r in child_results if r.get("score", 0) >= threshold]

    parent_ids = list(dict.fromkeys(r["parent_id"] for r in child_results if r.get("parent_id")))
    parents_by_id = {}
    if parent_ids:
        parents = await db.parents.find(
            {"tenant_id": tenant_id, "parent_id": {"$in": parent_ids}},
            {
                "_id": 0,
                "parent_id": 1,
                "url": 1,
                "title": 1,
                "section_title": 1,
                "section_path": 1,
                "headings": 1,
                "text": 1,
                "token_count": 1,
                "parent_index": 1,
            },
        ).to_list(length=len(parent_ids))
        parents_by_id = {parent["parent_id"]: parent for parent in parents}

    results = []
    seen_contexts = set()
    for child in child_results:
        parent = parents_by_id.get(child.get("parent_id"))
        if parent:
            key = parent["parent_id"]
            if key in seen_contexts:
                continue

            context_text, context_scope = await _context_for_parent_match(tenant_id, parent, child)
            merged = {
                "parent_id": parent["parent_id"],
                "url": parent["url"],
                "title": parent.get("title"),
                "section_title": parent.get("section_title"),
                "section_path": parent.get("section_path"),
                "headings": parent.get("headings", {}),
                "text": context_text,
                "context_scope": context_scope,
                "parent_index": parent.get("parent_index"),
                "score": child["score"],
                "child_text": child["text"],
                "child_index": child.get("child_index"),
            }
        else:
            key = f"{child.get('url')}:{child.get('chunk_index')}:{child.get('text')}"
            if key in seen_contexts:
                continue

            merged = child

        seen_contexts.add(key)
        results.append(merged)
        if len(results) >= top_k:
            break

    return results

async def _context_for_parent_match(tenant_id: str, parent: dict, child: dict) -> tuple[str, str]:
    parent_text = parent.get("text", "")
    parent_token_count = parent.get("token_count")
    if parent_token_count is None:
        parent_token_count = count_tokens(parent_text)

    if parent_token_count <= MAX_PARENT_CONTEXT_TOKENS:
        return parent_text, "parent_section"

    child_index = child.get("child_index")
    if child_index is None:
        return child.get("text", ""), "matched_child"

    start_index = max(0, child_index - CHILD_CONTEXT_RADIUS)
    end_index = child_index + CHILD_CONTEXT_RADIUS
    child_window = await db.chunks.find(
        {
            "tenant_id": tenant_id,
            "parent_id": parent["parent_id"],
            "child_index": {"$gte": start_index, "$lte": end_index},
        },
        {
            "_id": 0,
            "text": 1,
            "child_index": 1,
        },
    ).sort("child_index", 1).to_list(length=(CHILD_CONTEXT_RADIUS * 2) + 1)

    if not child_window:
        return child.get("text", ""), "matched_child"

    return "\n\n".join(item["text"] for item in child_window), "child_window"
