import asyncio
import uuid
from datetime import datetime, timezone

import httpx
from core.auth import db
from services.embedder import embed_texts
from langchain_text_splitters import RecursiveCharacterTextSplitter
from core.config import settings

MAX_PAGES = 200
CHUNK_SIZE = 512
CHUNK_OVERLAP = 50
EMBEDDING_BATCH_SIZE = 100

async def crawl_task(tenant_id: str, seed_url: str, job_id: str):
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

        pages = await _crawl_with_firecrawl(seed_url)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )

        pages_found = 0
        chunks_created = 0
        embedding_errors = 0
        indexed_urls = []

        for page in pages:
            result = await _index_page(tenant_id, job_id, page, splitter)
            if not result:
                continue

            chunks_created += result["chunks_created"]
            embedding_errors += result["embedding_errors"]
            if result["indexed"]:
                pages_found += 1
                indexed_urls.append(result["url"])

            await db.crawl_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "pages_found": pages_found,
                    "chunks_created": chunks_created,
                    "embedding_errors": embedding_errors,
                }}
            )

        if indexed_urls:
            await _delete_previous_versions(tenant_id, job_id, indexed_urls)

        await db.crawl_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "done",
                "pages_found": pages_found,
                "chunks_created": chunks_created,
                "finished_at": datetime.now(timezone.utc)
            }}
        )

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

        while True:
            await asyncio.sleep(5)
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

async def _index_page(
    tenant_id: str,
    crawl_id: str,
    page: dict,
    splitter: RecursiveCharacterTextSplitter,
) -> dict | None:
    content = page.get("markdown", "").strip()
    url = page.get("metadata", {}).get("sourceURL", "")
    title = page.get("metadata", {}).get("title", "")

    if not content or len(content) < 50 or not url:
        return None

    page_id = str(uuid.uuid4())
    chunks = splitter.split_text(content)
    if not chunks:
        return None

    chunk_docs = []
    embedding_errors = 0
    for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch = chunks[start:start + EMBEDDING_BATCH_SIZE]
        try:
            embeddings = await embed_texts(batch)
        except Exception as exc:
            print(f"Embedding batch failed for {url}: {exc}")
            embedding_errors += len(batch)
            continue

        if len(embeddings) != len(batch):
            embedding_errors += len(batch)
            continue

        for offset, (chunk, embedding) in enumerate(zip(batch, embeddings)):
            if not embedding:
                embedding_errors += 1
                continue

            chunk_docs.append({
                "tenant_id": tenant_id,
                "crawl_id": crawl_id,
                "page_id": page_id,
                "url": url,
                "title": title,
                "text": chunk,
                "embedding": embedding,
                "chunk_index": start + offset,
                "indexed_at": datetime.now(timezone.utc),
            })

    if not chunk_docs:
        return {
            "url": url,
            "indexed": False,
            "chunks_created": 0,
            "embedding_errors": embedding_errors or len(chunks),
        }

    page_doc = {
        "tenant_id": tenant_id,
        "crawl_id": crawl_id,
        "page_id": page_id,
        "url": url,
        "title": title,
        "content": content,
        "crawled_at": datetime.now(timezone.utc)
    }

    try:
        await db.pages.insert_one(page_doc)
        for start in range(0, len(chunk_docs), EMBEDDING_BATCH_SIZE):
            await db.chunks.insert_many(chunk_docs[start:start + EMBEDDING_BATCH_SIZE])
    except Exception:
        await db.pages.delete_many({"tenant_id": tenant_id, "page_id": page_id})
        await db.chunks.delete_many({"tenant_id": tenant_id, "page_id": page_id})
        raise

    return {
        "url": url,
        "indexed": True,
        "chunks_created": len(chunk_docs),
        "embedding_errors": embedding_errors,
    }

async def _delete_previous_versions(tenant_id: str, crawl_id: str, urls: list[str]) -> None:
    await db.chunks.delete_many({
        "tenant_id": tenant_id,
        "url": {"$in": urls},
        "crawl_id": {"$ne": crawl_id},
    })
    await db.pages.delete_many({
        "tenant_id": tenant_id,
        "url": {"$in": urls},
        "crawl_id": {"$ne": crawl_id},
    })
