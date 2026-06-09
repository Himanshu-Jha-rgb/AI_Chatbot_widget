from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from core.auth import create_access_token, get_current_tenant, db
from core.config import settings
import os

router = APIRouter(prefix="/admin", tags=["admin"])

class AdminLogin(BaseModel):
    username: str
    password: str

# Use environment variables for admin credentials, with fallbacks for local dev
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

@router.post("/login")
async def admin_login(creds: AdminLogin):
    if creds.username == ADMIN_USERNAME and creds.password == ADMIN_PASSWORD:
        # Create a special token for admin
        access_token = create_access_token(data={"sub": "system_admin", "role": "admin"})
        return {"access_token": access_token, "token_type": "bearer"}
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect admin username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from core.auth import ALGORITHM

security = HTTPBearer()

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        role: str = payload.get("role")
        if role != "admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    return {"username": "admin", "role": "admin"}

@router.get("/tenants")
async def get_all_tenants(admin: dict = Depends(get_current_admin)):
    tenants_cursor = db.tenants.find({}, {"password_hash": 0})
    tenants = await tenants_cursor.to_list(length=None)
    
    for t in tenants:
        t["_id"] = str(t["_id"])
        
    return tenants

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, admin: dict = Depends(get_current_admin)):
    result = await db.tenants.delete_one({"tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    # Cascade delete tenant's data
    await db.pages.delete_many({"tenant_id": tenant_id})
    await db.chunks.delete_many({"tenant_id": tenant_id})
    await db.parents.delete_many({"tenant_id": tenant_id})
    await db.conversations.delete_many({"tenant_id": tenant_id})
    await db.sources.delete_many({"tenant_id": tenant_id})
    await db.leads.delete_many({"tenant_id": tenant_id})
    await db.crawl_jobs.delete_many({"tenant_id": tenant_id})
    await db.faqs.delete_many({"tenant_id": tenant_id})
    await db.documents.delete_many({"tenant_id": tenant_id})
    await db.visitors.delete_many({"tenant_id": tenant_id})
    
    return {"message": "Tenant and associated data deleted successfully"}
