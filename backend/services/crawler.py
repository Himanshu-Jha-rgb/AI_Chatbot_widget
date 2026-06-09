import asyncio
import uuid
from datetime import datetime, timezone

import httpx
from core.auth import db
from services.ingestion import ingest_document
from services.suggested import generate_suggested_questions
from core.config import settings

MAX_PAGES = 200

def normalize_url(url: str) -> str:
    url = url.strip().lower()
    if url.startswith("http://"):
        url = url[7:]
    elif url.startswith("https://"):
        url = url[8:]
    return url.rstrip("/")

async def crawl_task(tenant_id: str, seed_url: str, job_id: str, source_id: str = ""):
    await db.crawl_jobs.update_one(
        {"job_id": job_id},
        {"$set": {
            "status": "running",
            "started_at": datetime.now(timezone.utc),
            "embedding_errors": 0,
            "error": None,
        }}
    )

    try:
        if not settings.FIRECRAWL_API_KEY:
            raise ValueError("FIRECRAWL_API_KEY is not configured")

        # Purge all old data for this site before re-crawling
        old_jobs = await db.crawl_jobs.find(
            {"tenant_id": tenant_id, "job_id": {"$ne": job_id}},
            {"job_id": 1, "seed_url": 1}
        ).to_list(length=100)
        old_crawl_ids = [j["job_id"] for j in old_jobs if normalize_url(j.get("seed_url", "")) == seed_url]
        if old_crawl_ids:
            await db.chunks.delete_many({"tenant_id": tenant_id, "crawl_id": {"$in": old_crawl_ids}})
            await db.parents.delete_many({"tenant_id": tenant_id, "crawl_id": {"$in": old_crawl_ids}})
            await db.pages.delete_many({"tenant_id": tenant_id, "crawl_id": {"$in": old_crawl_ids}})

        pages = await _crawl_with_firecrawl(seed_url)

        pages_found = 0
        chunks_created = 0
        embedding_errors = 0

        for page in pages:
            result = await _index_page(tenant_id, job_id, page, source_id)
            if not result:
                continue

            chunks_created += result["chunks_created"]
            embedding_errors += result["embedding_errors"]
            if result["indexed"]:
                pages_found += 1

            await db.crawl_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "pages_found": pages_found,
                    "chunks_created": chunks_created,
                    "embedding_errors": embedding_errors,
                }}
            )

        await db.crawl_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "done",
                "pages_found": pages_found,
                "chunks_created": chunks_created,
                "finished_at": datetime.now(timezone.utc)
            }}
        )

        # Auto-generate suggested questions after successful crawl
        if pages_found > 0:
            asyncio.create_task(generate_suggested_questions(tenant_id))

    except Exception as e:
        print(f"Crawl job {job_id} failed: {e}")
        await db.crawl_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "finished_at": datetime.now(timezone.utc)
            }}
        )

async def _crawl_with_firecrawl(seed_url: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"}
    async with httpx.AsyncClient(timeout=60.0) as client:
        crawl_response = await client.post(
            "https://api.firecrawl.dev/v1/crawl",
            headers=headers,
            json={
                "url": seed_url,
                "limit": MAX_PAGES,
                "scrapeOptions": {"formats": ["markdown"]}
            }
        )
        crawl_response.raise_for_status()
        firecrawl_job_id = crawl_response.json()["id"]

        # Timeout after 8 minutes — Render free tier kills processes after ~15 min idle
        max_wait = 480
        elapsed = 0

        while elapsed < max_wait:
            await asyncio.sleep(5)
            elapsed += 5
            status_response = await client.get(
                f"https://api.firecrawl.dev/v1/crawl/{firecrawl_job_id}",
                headers=headers
            )
            status_response.raise_for_status()
            status_data = status_response.json()

            if status_data["status"] == "completed":
                return status_data.get("data", [])
            if status_data["status"] == "failed":
                raise RuntimeError("Firecrawl job failed")

        raise RuntimeError(f"Firecrawl crawl timed out after {max_wait}s — job may still be running on Firecrawl")

async def _index_page(
    tenant_id: str,
    crawl_id: str,
    page: dict,
    source_id: str = "",
) -> dict | None:
    content = page.get("markdown", "").strip()
    url = page.get("metadata", {}).get("sourceURL", "")
    title = page.get("metadata", {}).get("title", "")

    if not content or len(content) < 50 or not url:
        return None

    doc_id = str(uuid.uuid4())
    result = await ingest_document(
        tenant_id=tenant_id,
        source_id=source_id,
        doc_id=doc_id,
        content=content,
        title=title,
        url=url,
        crawl_id=crawl_id,
    )

    if result["indexed"]:
        return {
            "url": url,
            "indexed": True,
            "chunks_created": result["chunks_created"],
            "embedding_errors": result["embedding_errors"],
        }

    return {
        "url": url,
        "indexed": False,
        "chunks_created": 0,
        "embedding_errors": result["embedding_errors"] or 1,
    }


