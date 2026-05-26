from fastapi import APIRouter, Depends, BackgroundTasks
from models.schemas import CrawlRequest, CrawlJobResponse
from core.auth import verify_api_key, get_current_tenant, db
from services.crawler import crawl_task
import uuid

router = APIRouter(tags=["crawl"])

@router.post("/crawl", response_model=CrawlJobResponse)
async def start_crawl(req: CrawlRequest, background_tasks: BackgroundTasks, current_tenant: dict = Depends(verify_api_key)):
    job_id = str(uuid.uuid4())
    await db.crawl_jobs.insert_one({
        "tenant_id": current_tenant["tenant_id"],
        "job_id": job_id,
        "seed_url": req.seed_url,
        "status": "queued",
        "pages_found": 0,
        "chunks_created": 0,
        "started_at": None,
        "finished_at": None
    })
    
    background_tasks.add_task(crawl_task, current_tenant["tenant_id"], req.seed_url, job_id)
    return {"job_id": job_id}

@router.get("/crawl/{job_id}")
async def get_crawl_status(job_id: str, current_tenant: dict = Depends(verify_api_key)):
    job = await db.crawl_jobs.find_one({"job_id": job_id, "tenant_id": current_tenant["tenant_id"]}, {"_id": 0})
    return job

@router.delete("/index")
async def delete_index(current_tenant: dict = Depends(verify_api_key)):
    tenant_id = current_tenant["tenant_id"]
    await db.chunks.delete_many({"tenant_id": tenant_id})
    await db.pages.delete_many({"tenant_id": tenant_id})
    return {"status": "deleted"}
    
@router.post("/dashboard/crawl", response_model=CrawlJobResponse)
async def dashboard_start_crawl(req: CrawlRequest, background_tasks: BackgroundTasks, current_tenant: dict = Depends(get_current_tenant)):
    job_id = str(uuid.uuid4())
    await db.crawl_jobs.insert_one({
        "tenant_id": current_tenant["tenant_id"],
        "job_id": job_id,
        "seed_url": req.seed_url,
        "status": "queued",
        "pages_found": 0,
        "chunks_created": 0,
        "started_at": None,
        "finished_at": None
    })
    background_tasks.add_task(crawl_task, current_tenant["tenant_id"], req.seed_url, job_id)
    return {"job_id": job_id}

@router.get("/dashboard/crawl/{job_id}")
async def dashboard_get_crawl_status(job_id: str, current_tenant: dict = Depends(get_current_tenant)):
    job = await db.crawl_jobs.find_one({"job_id": job_id, "tenant_id": current_tenant["tenant_id"]}, {"_id": 0})
    return job

@router.delete("/dashboard/index")
async def dashboard_delete_index(current_tenant: dict = Depends(get_current_tenant)):
    tenant_id = current_tenant["tenant_id"]
    await db.chunks.delete_many({"tenant_id": tenant_id})
    await db.pages.delete_many({"tenant_id": tenant_id})
    return {"status": "deleted"}
