import asyncio
import uuid
from datetime import datetime

import httpx
from core.auth import db
from services.embedder import embed_text
from langchain_text_splitters import RecursiveCharacterTextSplitter
from core.config import settings

MAX_PAGES = 200

async def crawl_task(tenant_id: str, seed_url: str, job_id: str):
    await db.crawl_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"status": "running", "started_at": datetime.utcnow()}}
    )

    try:
        if not settings.FIRECRAWL_API_KEY:
            raise ValueError("FIRECRAWL_API_KEY is not configured")

        # Trigger Firecrawl crawl job
        async with httpx.AsyncClient(timeout=60.0) as client:
            crawl_response = await client.post(
                "https://api.firecrawl.dev/v1/crawl",
                headers={"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"},
                json={
                    "url": seed_url,
                    "limit": MAX_PAGES,
                    "scrapeOptions": {"formats": ["markdown"]}
                }
            )
            crawl_response.raise_for_status()
            firecrawl_job_id = crawl_response.json()["id"]

            # Poll until done
            while True:
                await asyncio.sleep(5)
                status_response = await client.get(
                    f"https://api.firecrawl.dev/v1/crawl/{firecrawl_job_id}",
                    headers={"Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}"}
                )
                status_response.raise_for_status()
                status_data = status_response.json()

                if status_data["status"] == "completed":
                    pages = status_data.get("data", [])
                    break
                elif status_data["status"] == "failed":
                    raise Exception("Firecrawl job failed")

        splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
        sem = asyncio.Semaphore(5)

        pages_found = 0
        chunks_created = 0

        for page in pages:
            content = page.get("markdown", "").strip()
            url = page.get("metadata", {}).get("sourceURL", "")
            title = page.get("metadata", {}).get("title", "")

            if not content or len(content) < 50:
                continue

            page_id = str(uuid.uuid4())
            await db.pages.insert_one({
                "tenant_id": tenant_id,
                "page_id": page_id,
                "url": url,
                "title": title,
                "content": content,
                "crawled_at": datetime.utcnow()
            })
            pages_found += 1

            chunks = splitter.split_text(content)

            async def process_chunk(idx, chunk):
                async with sem:
                    embedding = await embed_text(chunk)
                    await db.chunks.insert_one({
                        "tenant_id": tenant_id,
                        "page_id": page_id,
                        "url": url,
                        "title": title,
                        "text": chunk,
                        "embedding": embedding,
                        "chunk_index": idx
                    })
                    return 1

            tasks = [process_chunk(idx, chunk) for idx, chunk in enumerate(chunks)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            chunks_created += sum(1 for r in results if r == 1)

        await db.crawl_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "done",
                "pages_found": pages_found,
                "chunks_created": chunks_created,
                "finished_at": datetime.utcnow()
            }}
        )

    except Exception as e:
        print(f"Crawl job {job_id} failed: {e}")
        await db.crawl_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "finished_at": datetime.utcnow()
            }}
        )
