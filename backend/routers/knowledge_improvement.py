from fastapi import APIRouter, Depends, HTTPException, Query
from core.auth import get_current_tenant, db
from services.embedder import openai_client
from services.ingestion import ingest_faq_pair
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
import numpy as np
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard/knowledge", tags=["knowledge-improvement"])


class GapResponse(BaseModel):
    gap_id: str
    query: str
    url: str
    gap_type: str
    count: int
    status: str
    first_seen: datetime
    last_seen: datetime
    resolved_by_faq_id: Optional[str] = None
    similar_faqs: list = []


class ResolveGapRequest(BaseModel):
    action: str  # "create_faq" | "dismiss"
    faq_question: Optional[str] = None
    faq_answer: Optional[str] = None
    source_id: Optional[str] = None


@router.get("/gaps")
async def list_knowledge_gaps(
    current_tenant: dict = Depends(get_current_tenant),
    status: str = Query("open"),
    limit: int = Query(50),
    skip: int = Query(0),
):
    """List knowledge gaps for the tenant, grouped by similarity."""
    tenant_id = current_tenant["tenant_id"]

    query_filter = {"tenant_id": tenant_id}
    if status != "all":
        query_filter["status"] = status

    all_gaps = await db.knowledge_gaps.find(query_filter).sort("count", -1).to_list(1000)
    gaps = all_gaps[skip:skip + limit]

    result = []
    for gap in gaps:
        try:
            gap["gap_id"] = str(gap["_id"])
            gap.pop("_id", None)
            gap.pop("embedding", None)
            result.append(gap)
        except Exception as e:
            print(f"[KNOWLEDGE] error processing gap: {e}")

    return result


@router.post("/gaps/{gap_id}/resolve")
async def resolve_knowledge_gap(
    gap_id: str,
    req: ResolveGapRequest,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Resolve a knowledge gap by creating an FAQ or dismissing."""
    tenant_id = current_tenant["tenant_id"]

    gap = await db.knowledge_gaps.find_one({"_id": ObjectId(gap_id), "tenant_id": tenant_id})
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")

    if req.action == "create_faq":
        if not req.faq_question or not req.faq_answer or not req.source_id:
            raise HTTPException(status_code=400, detail="faq_question, faq_answer, and source_id required")

        faq_id = await ingest_faq_pair(
            tenant_id=tenant_id,
            source_id=req.source_id,
            question=req.faq_question,
            answer=req.faq_answer,
        )

        # Generate embedding for the FAQ
        embedding_resp = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=f"Q: {req.faq_question}\nA: {req.faq_answer}",
        )
        faq_embedding = embedding_resp.data[0].embedding

        await db.faqs.update_one(
            {"_id": ObjectId(faq_id)},
            {"$set": {"embedding": faq_embedding}}
        )

        await db.knowledge_gaps.update_one(
            {"_id": ObjectId(gap_id)},
            {"$set": {"status": "resolved", "resolved_by_faq_id": faq_id}}
        )

        return {"status": "ok", "faq_id": faq_id}

    elif req.action == "dismiss":
        await db.knowledge_gaps.update_one(
            {"_id": ObjectId(gap_id)},
            {"$set": {"status": "dismissed"}}
        )
        return {"status": "ok"}

    else:
        raise HTTPException(status_code=400, detail="Invalid action")


@router.get("/gaps/stats")
async def get_gap_stats(current_tenant: dict = Depends(get_current_tenant)):
    """Get knowledge gap statistics."""
    tenant_id = current_tenant["tenant_id"]

    total = await db.knowledge_gaps.count_documents({"tenant_id": tenant_id})
    open_count = await db.knowledge_gaps.count_documents({"tenant_id": tenant_id, "status": "open"})
    resolved = await db.knowledge_gaps.count_documents({"tenant_id": tenant_id, "status": "resolved"})
    dismissed = await db.knowledge_gaps.count_documents({"tenant_id": tenant_id, "status": "dismissed"})

    top_gaps = await db.knowledge_gaps.find(
        {"tenant_id": tenant_id, "status": "open"}
    ).sort("count", -1).limit(10).to_list(10)

    return {
        "total": total,
        "open": open_count,
        "resolved": resolved,
        "dismissed": dismissed,
        "top_gaps": [
            {"gap_id": str(g["_id"]), "query": g["query"], "count": g["count"]}
            for g in top_gaps
        ]
    }


@router.post("/gaps/cluster")
async def cluster_gaps(current_tenant: dict = Depends(get_current_tenant)):
    """Re-cluster gaps by similarity (run periodically or on-demand)."""
    tenant_id = current_tenant["tenant_id"]

    gaps = await db.knowledge_gaps.find(
        {"tenant_id": tenant_id, "status": "open", "embedding": {"$exists": True}}
    ).to_list(1000)

    if len(gaps) < 2:
        return {"clusters": 0, "message": "Not enough gaps to cluster"}

    clustered = 0
    for i, gap_a in enumerate(gaps):
        if gap_a.get("cluster_id"):
            continue
        cluster_id = f"cluster_{gap_a['_id']}"
        await db.knowledge_gaps.update_one(
            {"_id": gap_a["_id"]},
            {"$set": {"cluster_id": cluster_id}}
        )
        a_emb = np.array(gap_a["embedding"])
        for gap_b in gaps[i + 1:]:
            if gap_b.get("cluster_id"):
                continue
            b_emb = np.array(gap_b["embedding"])
            cos_sim = np.dot(a_emb, b_emb) / (np.linalg.norm(a_emb) * np.linalg.norm(b_emb))
            if cos_sim > 0.85:
                await db.knowledge_gaps.update_one(
                    {"_id": gap_b["_id"]},
                    {"$set": {"cluster_id": cluster_id}}
                )
                clustered += 1

    return {"clusters_created": clustered, "total_gaps": len(gaps)}