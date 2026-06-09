from fastapi import APIRouter, Depends, HTTPException
from models.schemas import TenantRegister, TenantLogin, Token
from core.auth import db, get_password_hash, verify_password, create_access_token, get_current_tenant
import uuid
import secrets
from datetime import datetime, timezone

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.post("/register", response_model=Token)
async def register(tenant: TenantRegister):
    existing = await db.tenants.find_one({"domain": tenant.domain})
    if existing:
        raise HTTPException(status_code=400, detail="Domain already registered")
        
    tenant_id = str(uuid.uuid4())
    api_key = f"sk_live_{secrets.token_urlsafe(32)}"
    
    await db.tenants.insert_one({
        "tenant_id": tenant_id,
        "api_key": api_key,
        "domain": tenant.domain,
        "plan": tenant.plan,
        "theme": tenant.theme,
        "industry": tenant.industry,
        "password_hash": get_password_hash(tenant.password),
        "created_at": datetime.now(timezone.utc)
    })
    
    access_token = create_access_token(data={"sub": tenant_id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(tenant: TenantLogin):
    db_tenant = await db.tenants.find_one({"domain": tenant.domain})
    if not db_tenant or not verify_password(tenant.password, db_tenant["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect domain or password")
        
    access_token = create_access_token(data={"sub": db_tenant["tenant_id"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_me(current_tenant: dict = Depends(get_current_tenant)):
    return {
        "tenant_id": current_tenant["tenant_id"],
        "domain": current_tenant["domain"],
        "plan": current_tenant.get("plan", "free"),
        "theme": current_tenant.get("theme", "default"),
        "industry": current_tenant.get("industry"),
        "api_key": current_tenant["api_key"]
    }

@router.post("/rotate_key")
async def rotate_key(current_tenant: dict = Depends(get_current_tenant)):
    new_api_key = f"sk_live_{secrets.token_urlsafe(32)}"
    await db.tenants.update_one(
        {"tenant_id": current_tenant["tenant_id"]},
        {"$set": {"api_key": new_api_key}}
    )
    return {"api_key": new_api_key}

@router.get("/stats")
async def get_stats(current_tenant: dict = Depends(get_current_tenant)):
    tenant_id = current_tenant["tenant_id"]
    pages = await db.pages.count_documents({"tenant_id": tenant_id})
    chunks = await db.chunks.count_documents({"tenant_id": tenant_id})
    queries = await db.conversations.count_documents({"tenant_id": tenant_id})
    return {
        "pages_crawled": pages,
        "chunks_indexed": chunks,
        "queries_this_month": queries
    }
