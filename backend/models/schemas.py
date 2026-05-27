from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class TenantRegister(BaseModel):
    domain: str
    password: str
    plan: Optional[str] = "free"

class TenantLogin(BaseModel):
    domain: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class CrawlRequest(BaseModel):
    seed_url: str

class CrawlJobResponse(BaseModel):
    job_id: str

class ChatRequest(BaseModel):
    query: str
    session_id: str
    current_url: str
    current_page_title: str

class Source(BaseModel):
    url: str
    title: str
    section_title: Optional[str] = None
    section_path: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
