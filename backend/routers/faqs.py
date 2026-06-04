import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from core.auth import db, get_current_tenant
from models.schemas import FAQCreate, FAQUpdate

router = APIRouter(prefix="/dashboard/sources/{source_id}/faqs", tags=["faqs"])


def _faq_to_text(question: str, answer: str) -> str:
    return f"Q: {question}\nA: {answer}"


async def _verify_source(tenant_id: str, source_id: str) -> dict:
    source = await db.sources.find_one(
        {"tenant_id": tenant_id, "source_id": source_id},
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if source["source_type"] != "faq":
        raise HTTPException(status_code=400, detail="Source is not a FAQ source")
    return source


@router.get("")
async def list_faqs(
    source_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """List all FAQs for a source."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    faqs = await db.faqs.find(
        {"tenant_id": tenant_id, "source_id": source_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(length=1000)
    return faqs


@router.post("", status_code=201)
async def create_faq(
    source_id: str,
    body: FAQCreate,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Add a new FAQ pair."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    faq_id = str(uuid.uuid4())
    faq_doc = {
        "tenant_id": tenant_id,
        "source_id": source_id,
        "faq_id": faq_id,
        "question": body.question,
        "answer": body.answer,
        "created_at": datetime.now(timezone.utc),
    }
    await db.faqs.insert_one(faq_doc)
    faq_doc.pop("_id", None)
    return faq_doc


@router.put("/{faq_id}")
async def update_faq(
    source_id: str,
    faq_id: str,
    body: FAQUpdate,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Update an existing FAQ pair."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    update = {}
    if body.question is not None:
        update["question"] = body.question
    if body.answer is not None:
        update["answer"] = body.answer

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.faqs.update_one(
        {"tenant_id": tenant_id, "source_id": source_id, "faq_id": faq_id},
        {"$set": update},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")

    faq = await db.faqs.find_one(
        {"tenant_id": tenant_id, "source_id": source_id, "faq_id": faq_id},
        {"_id": 0},
    )
    return faq


@router.delete("/{faq_id}")
async def delete_faq(
    source_id: str,
    faq_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Delete a FAQ pair and its indexed chunks."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    result = await db.faqs.delete_one({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "faq_id": faq_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")

    # Remove indexed chunks for this FAQ
    page_id = f"faq_{faq_id}"
    await db.chunks.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": page_id,
    })
    await db.parents.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": page_id,
    })
    await db.pages.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": page_id,
    })

    return {"status": "deleted", "faq_id": faq_id}


# --- Indexing ---

async def _index_all_faqs(tenant_id: str, source_id: str):
    """Background task: index all FAQs as chunks."""
    from services.ingestion import ingest_document

    try:
        # Delete existing chunks for this source
        await db.chunks.delete_many({"tenant_id": tenant_id, "source_id": source_id})
        await db.parents.delete_many({"tenant_id": tenant_id, "source_id": source_id})
        await db.pages.delete_many({"tenant_id": tenant_id, "source_id": source_id})

        faqs = await db.faqs.find(
            {"tenant_id": tenant_id, "source_id": source_id},
        ).sort("created_at", 1).to_list(length=1000)

        total_chunks = 0
        for faq in faqs:
            text = _faq_to_text(faq["question"], faq["answer"])
            doc_id = f"faq_{faq['faq_id']}"
            result = await ingest_document(
                tenant_id=tenant_id,
                source_id=source_id,
                doc_id=doc_id,
                content=text,
                title=faq["question"][:80],
                url=f"faq://{faq['faq_id']}",
            )
            total_chunks += result["chunks_created"]

        await db.sources.update_one(
            {"tenant_id": tenant_id, "source_id": source_id},
            {"$set": {
                "status": "ready",
                "last_indexed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }}
        )
    except Exception as e:
        print(f"FAQ indexing failed for {source_id}: {e}")
        await db.sources.update_one(
            {"tenant_id": tenant_id, "source_id": source_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc),
            }}
        )


@router.post("/index")
async def index_faqs(
    source_id: str,
    background_tasks: BackgroundTasks,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Index all FAQs as searchable chunks."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    await db.sources.update_one(
        {"tenant_id": tenant_id, "source_id": source_id},
        {"$set": {"status": "indexing", "updated_at": datetime.now(timezone.utc)}},
    )

    background_tasks.add_task(_index_all_faqs, tenant_id, source_id)
    return {"status": "indexing", "source_id": source_id}
