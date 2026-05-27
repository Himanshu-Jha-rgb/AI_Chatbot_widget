import asyncio
import re
import uuid
from datetime import datetime, timezone

import httpx
from core.auth import db
from services.embedder import embed_texts
from services.tokens import TOKEN_ENCODING_NAME, count_tokens
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from core.config import settings

MAX_PAGES = 200
CHILD_CHUNK_TOKENS = 500
CHILD_CHUNK_OVERLAP_TOKENS = 80
MIN_CHILD_CHUNK_TOKENS = 40
MIN_SECTION_BODY_TOKENS = 8
EMBEDDING_BATCH_SIZE = 100
MARKDOWN_HEADERS = [
    ("#", "heading_1"),
    ("##", "heading_2"),
    ("###", "heading_3"),
    ("####", "heading_4"),
]
HEADING_KEYS = [header_name for _, header_name in MARKDOWN_HEADERS]

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
        parent_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=MARKDOWN_HEADERS,
            strip_headers=False,
        )
        child_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            encoding_name=TOKEN_ENCODING_NAME,
            chunk_size=CHILD_CHUNK_TOKENS,
            chunk_overlap=CHILD_CHUNK_OVERLAP_TOKENS,
        )

        pages_found = 0
        chunks_created = 0
        embedding_errors = 0
        indexed_urls = []

        for page in pages:
            result = await _index_page(tenant_id, job_id, page, parent_splitter, child_splitter)
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
    parent_splitter: MarkdownHeaderTextSplitter,
    child_splitter: RecursiveCharacterTextSplitter,
) -> dict | None:
    content = page.get("markdown", "").strip()
    url = page.get("metadata", {}).get("sourceURL", "")
    title = page.get("metadata", {}).get("title", "")

    if not content or len(content) < 50 or not url:
        return None

    page_id = str(uuid.uuid4())
    parent_sections = _build_parent_sections(parent_splitter, content, title)
    if not parent_sections:
        return None

    parent_docs = []
    child_records = []
    for parent_index, section in enumerate(parent_sections):
        parent_id = f"{page_id}:{parent_index}"
        parent_text = section["text"]
        parent_docs.append({
            "tenant_id": tenant_id,
            "crawl_id": crawl_id,
            "page_id": page_id,
            "parent_id": parent_id,
            "url": url,
            "title": title,
            "section_title": section["section_title"],
            "section_path": section["section_path"],
            "headings": section["headings"],
            "text": parent_text,
            "token_count": count_tokens(parent_text),
            "parent_index": parent_index,
            "indexed_at": datetime.now(timezone.utc),
        })

        child_chunks = _split_child_chunks(child_splitter, parent_text)
        section_label = section["section_title"] or section["section_path"]
        for child_index, child in enumerate(child_chunks):
            # Prepend section heading so embeddings capture key descriptive keywords
            prefixed = f"{section_label}:\n{child}"
            child_records.append({
                "parent_id": parent_id,
                "parent_index": parent_index,
                "child_index": child_index,
                "section_title": section["section_title"],
                "section_path": section["section_path"],
                "headings": section["headings"],
                "text": child,
                "search_text": prefixed,
                "token_count": count_tokens(prefixed),
            })

    if not child_records:
        return None

    chunk_docs = []
    embedding_errors = 0
    for start in range(0, len(child_records), EMBEDDING_BATCH_SIZE):
        batch = child_records[start:start + EMBEDDING_BATCH_SIZE]
        try:
            embeddings = await embed_texts([item["search_text"] for item in batch])
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
                "parent_id": chunk["parent_id"],
                "url": url,
                "title": title,
                "section_title": chunk["section_title"],
                "section_path": chunk["section_path"],
                "headings": chunk["headings"],
                "text": chunk["text"],
                "token_count": chunk["token_count"],
                "embedding": embedding,
                "chunk_index": start + offset,
                "parent_index": chunk["parent_index"],
                "child_index": chunk["child_index"],
                "indexed_at": datetime.now(timezone.utc),
            })

    if not chunk_docs:
        return {
            "url": url,
            "indexed": False,
            "chunks_created": 0,
            "embedding_errors": embedding_errors or len(child_records),
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
        await db.parents.insert_many(parent_docs)
        for start in range(0, len(chunk_docs), EMBEDDING_BATCH_SIZE):
            await db.chunks.insert_many(chunk_docs[start:start + EMBEDDING_BATCH_SIZE])
    except Exception:
        await db.pages.delete_many({"tenant_id": tenant_id, "page_id": page_id})
        await db.parents.delete_many({"tenant_id": tenant_id, "page_id": page_id})
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
    await db.parents.delete_many({
        "tenant_id": tenant_id,
        "url": {"$in": urls},
        "crawl_id": {"$ne": crawl_id},
    })
    await db.pages.delete_many({
        "tenant_id": tenant_id,
        "url": {"$in": urls},
        "crawl_id": {"$ne": crawl_id},
    })

def _build_parent_sections(
    splitter: MarkdownHeaderTextSplitter,
    content: str,
    page_title: str,
) -> list[dict]:
    sections = []
    for doc in splitter.split_text(content):
        text = doc.page_content.strip()
        if not text:
            continue

        body_text = _section_body_text(text)
        if not body_text or count_tokens(body_text) < MIN_SECTION_BODY_TOKENS:
            continue

        headings = {key: value for key, value in doc.metadata.items() if key in HEADING_KEYS}
        section_path_parts = [headings[key] for key in HEADING_KEYS if headings.get(key)]
        section_path = " > ".join(section_path_parts) or page_title or "Untitled section"
        section_title = section_path_parts[-1] if section_path_parts else page_title or "Untitled section"

        sections.append({
            "text": text,
            "section_title": section_title,
            "section_path": section_path,
            "headings": headings,
        })

    if sections:
        return sections

    return [{
        "text": content.strip(),
        "section_title": page_title or "Untitled section",
        "section_path": page_title or "Untitled section",
        "headings": {},
    }]

def _split_child_chunks(
    splitter: RecursiveCharacterTextSplitter,
    parent_text: str,
) -> list[str]:
    raw_chunks = [chunk.strip() for chunk in splitter.split_text(parent_text) if chunk.strip()]
    if len(raw_chunks) <= 1:
        return raw_chunks

    chunks = []
    pending = ""
    for chunk in raw_chunks:
        if pending:
            chunk = f"{pending}\n\n{chunk}"
            pending = ""

        if count_tokens(chunk) < MIN_CHILD_CHUNK_TOKENS:
            pending = chunk
            continue

        chunks.append(chunk)

    if pending:
        if chunks:
            chunks[-1] = f"{chunks[-1]}\n\n{pending}"
        else:
            chunks.append(pending)

    return chunks

def _section_body_text(section_text: str) -> str:
    body_lines = []
    for line in section_text.splitlines():
        if re.match(r"^\s{0,3}#{1,6}\s+", line):
            continue

        body_lines.append(line)

    return "\n".join(body_lines).strip()
