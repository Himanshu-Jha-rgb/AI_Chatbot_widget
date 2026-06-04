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
    session_id: Optional[str] = None
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

# --- Source Management ---

class SourceCreate(BaseModel):
    source_type: str = Field(..., pattern=r"^(pdf|faq|text|website)$")
    name: str

class SourceResponse(BaseModel):
    source_id: str
    source_type: str
    name: str
    status: str
    chunk_count: int
    config: dict
    created_at: datetime
    last_indexed_at: Optional[datetime] = None

# --- FAQs ---

class FAQCreate(BaseModel):
    question: str
    answer: str

class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None

class FAQResponse(BaseModel):
    faq_id: str
    source_id: str
    question: str
    answer: str
    created_at: datetime

# --- Text Documents ---

class TextDocCreate(BaseModel):
    title: str
    body: str

class TextDocUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None

class TextDocResponse(BaseModel):
    doc_id: str
    source_id: str
    title: str
    body: str
    created_at: datetime
    updated_at: datetime
