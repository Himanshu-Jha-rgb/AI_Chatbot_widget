import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from core.auth import db, get_current_tenant
from models.schemas import TextDocCreate, TextDocUpdate

router = APIRouter(prefix="/dashboard/sources/{source_id}/docs", tags=["text_docs"])


async def _verify_source(tenant_id: str, source_id: str) -> dict:
    source = await db.sources.find_one(
        {"tenant_id": tenant_id, "source_id": source_id},
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if source["source_type"] != "text":
        raise HTTPException(status_code=400, detail="Source is not a text document source")
    return source


@router.get("")
async def list_docs(
    source_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """List all text documents for a source."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    docs = await db.documents.find(
        {"tenant_id": tenant_id, "source_id": source_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(length=1000)
    return docs


@router.post("", status_code=201)
async def create_doc(
    source_id: str,
    body: TextDocCreate,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Create a new text document."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "tenant_id": tenant_id,
        "source_id": source_id,
        "doc_id": doc_id,
        "title": body.title,
        "body": body.body,
        "created_at": now,
        "updated_at": now,
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{doc_id}")
async def update_doc(
    source_id: str,
    doc_id: str,
    body: TextDocUpdate,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Update an existing text document."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    update = {}
    if body.title is not None:
        update["title"] = body.title
    if body.body is not None:
        update["body"] = body.body

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    update["updated_at"] = datetime.now(timezone.utc)

    result = await db.documents.update_one(
        {"tenant_id": tenant_id, "source_id": source_id, "doc_id": doc_id},
        {"$set": update},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = await db.documents.find_one(
        {"tenant_id": tenant_id, "source_id": source_id, "doc_id": doc_id},
        {"_id": 0},
    )
    return doc


@router.delete("/{doc_id}")
async def delete_doc(
    source_id: str,
    doc_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Delete a text document."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    result = await db.documents.delete_one({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "doc_id": doc_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    # Also remove its chunks
    await db.chunks.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": f"doc_{doc_id}",
    })
    await db.parents.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": f"doc_{doc_id}",
    })
    await db.pages.delete_many({
        "tenant_id": tenant_id,
        "source_id": source_id,
        "page_id": f"doc_{doc_id}",
    })

    return {"status": "deleted", "doc_id": doc_id}


# --- Indexing ---

async def _index_all_docs(tenant_id: str, source_id: str):
    """Background task: index all text documents as chunks."""
    from services.ingestion import ingest_document

    try:
        # Delete existing chunks for this source
        await db.chunks.delete_many({"tenant_id": tenant_id, "source_id": source_id})
        await db.parents.delete_many({"tenant_id": tenant_id, "source_id": source_id})
        await db.pages.delete_many({"tenant_id": tenant_id, "source_id": source_id})

        docs = await db.documents.find(
            {"tenant_id": tenant_id, "source_id": source_id},
        ).sort("created_at", 1).to_list(length=1000)

        total_chunks = 0
        for doc in docs:
            doc_id = f"doc_{doc['doc_id']}"
            result = await ingest_document(
                tenant_id=tenant_id,
                source_id=source_id,
                doc_id=doc_id,
                content=doc["body"],
                title=doc["title"],
                url=f"doc://{doc['doc_id']}",
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
        print(f"Text doc indexing failed for {source_id}: {e}")
        await db.sources.update_one(
            {"tenant_id": tenant_id, "source_id": source_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc),
            }}
        )


@router.post("/index")
async def index_docs(
    source_id: str,
    background_tasks: BackgroundTasks,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Index all text documents as searchable chunks."""
    tenant_id = current_tenant["tenant_id"]
    await _verify_source(tenant_id, source_id)

    await db.sources.update_one(
        {"tenant_id": tenant_id, "source_id": source_id},
        {"$set": {"status": "indexing", "updated_at": datetime.now(timezone.utc)}},
    )

    background_tasks.add_task(_index_all_docs, tenant_id, source_id)
    return {"status": "indexing", "source_id": source_id}
