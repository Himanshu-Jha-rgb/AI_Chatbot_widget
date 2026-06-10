import os
import uuid
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form

from core.auth import db, get_current_tenant
from models.schemas import SourceCreate, SourceResponse
from services.pdf_parser import extract_text_from_pdf
from services.ingestion import ingest_document

router = APIRouter(prefix="/dashboard/sources", tags=["sources"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


async def _delete_source_data(tenant_id: str, source_id: str) -> None:
    """Delete all indexed data for a source."""
    await db.chunks.delete_many({"tenant_id": tenant_id, "source_id": source_id})
    await db.parents.delete_many({"tenant_id": tenant_id, "source_id": source_id})
    await db.pages.delete_many({"tenant_id": tenant_id, "source_id": source_id})


@router.get("")
async def list_sources(current_tenant: dict = Depends(get_current_tenant)):
    """List all knowledge sources for the tenant, including website crawls."""
    tenant_id = current_tenant["tenant_id"]
    sources = await db.sources.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)

    # Attach chunk counts
    for source in sources:
        source["chunk_count"] = await db.chunks.count_documents({
            "tenant_id": tenant_id,
            "source_id": source["source_id"],
        })

    # Merge completed crawl jobs as website-type sources
    crawl_jobs = await db.crawl_jobs.find(
        {"tenant_id": tenant_id, "status": "done"},
        {"_id": 0}
    ).sort("started_at", -1).to_list(length=100)

    for job in crawl_jobs:
        sources.append({
            "tenant_id": tenant_id,
            "source_id": f"crawl_{job.get('job_id', '')}",
            "source_type": "website",
            "name": job.get("seed_url", "Website"),
            "status": "ready",
            "chunk_count": job.get("chunks_created", 0),
            "config": {
                "seed_url": job.get("seed_url"),
                "pages_found": job.get("pages_found", 0),
            },
            "created_at": job.get("started_at"),
            "last_indexed_at": job.get("finished_at"),
        })

    return sources


@router.post("", status_code=201)
async def create_source(
    body: SourceCreate,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Create a new knowledge source entry."""
    tenant_id = current_tenant["tenant_id"]
    source_id = str(uuid.uuid4())

    source_doc = {
        "tenant_id": tenant_id,
        "source_id": source_id,
        "source_type": body.source_type,
        "name": body.name,
        "config": {},
        "status": "ready",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_indexed_at": None,
    }

    await db.sources.insert_one(source_doc)
    source_doc.pop("_id", None)
    return source_doc


@router.get("/{source_id}")
async def get_source(
    source_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Get details for a specific source."""
    tenant_id = current_tenant["tenant_id"]
    source = await db.sources.find_one(
        {"tenant_id": tenant_id, "source_id": source_id},
        {"_id": 0},
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    source["chunk_count"] = await db.chunks.count_documents({
        "tenant_id": tenant_id,
        "source_id": source_id,
    })
    return source


@router.delete("/{source_id}")
async def delete_source(
    source_id: str,
    current_tenant: dict = Depends(get_current_tenant),
):
    """Delete a source and all its indexed data."""
    tenant_id = current_tenant["tenant_id"]
    source = await db.sources.find_one(
        {"tenant_id": tenant_id, "source_id": source_id},
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Delete PDF file if present
    config = source.get("config", {})
    file_path = config.get("file_path", "")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Delete source and its indexed data
    await db.sources.delete_one({"tenant_id": tenant_id, "source_id": source_id})
    await _delete_source_data(tenant_id, source_id)

    # Also clean up faqs and documents if applicable
    if source["source_type"] == "faq":
        await db.faqs.delete_many({"tenant_id": tenant_id, "source_id": source_id})
    elif source["source_type"] == "text":
        await db.documents.delete_many({"tenant_id": tenant_id, "source_id": source_id})

    return {"status": "deleted", "source_id": source_id}


# --- PDF Upload ---

async def _index_pdf_background(tenant_id: str, source_id: str, file_path: str, name: str):
    """Background task: extract text from PDF and index it."""
    try:
        text = extract_text_from_pdf(file_path)
        if not text.strip():
            raise ValueError("No text could be extracted from the PDF")

        doc_id = str(uuid.uuid4())
        result = await ingest_document(
            tenant_id=tenant_id,
            source_id=source_id,
            doc_id=doc_id,
            content=text,
            title=name,
            url=f"pdf://{os.path.basename(file_path)}",
        )

        await db.sources.update_one(
            {"tenant_id": tenant_id, "source_id": source_id},
            {"$set": {
                "status": "ready",
                "last_indexed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }}
        )
    except Exception as e:
        print(f"PDF indexing failed for {source_id}: {e}")
        await db.sources.update_one(
            {"tenant_id": tenant_id, "source_id": source_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc),
            }}
        )


@router.post("/pdf/upload", status_code=201)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    current_tenant: dict = Depends(get_current_tenant),
):
    """Upload a PDF file and index it as a knowledge source."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    tenant_id = current_tenant["tenant_id"]
    source_id = str(uuid.uuid4())

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{source_id}{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create source entry
    source_doc = {
        "tenant_id": tenant_id,
        "source_id": source_id,
        "source_type": "pdf",
        "name": name,
        "config": {
            "file_path": file_path,
            "original_name": file.filename,
        },
        "status": "indexing",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_indexed_at": None,
    }
    await db.sources.insert_one(source_doc)

    # Start background indexing
    background_tasks.add_task(
        _index_pdf_background, tenant_id, source_id, file_path, name
    )

    source_doc.pop("_id", None)
    return source_doc
