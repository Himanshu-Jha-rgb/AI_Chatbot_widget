from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from routers import tenants, crawl, chat, sources, faqs, text_docs, leads, admin
from core.config import settings
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.auth import db, limiter
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="Chatbot Widget SaaS")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Origin-reflection middleware for credentialed cross-origin requests.
# The embedded widget uses credentials: "include" for cookies, and the
# browser rejects Access-Control-Allow-Origin: * when credentials are set.
# Reflecting the request origin is the standard approach for SaaS embedded
# widgets where customer origins are not known ahead of time.
class CORSRreflectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")

        if request.method == "OPTIONS":
            response = Response(status_code=200)
            requested_headers = request.headers.get("access-control-request-headers", "")
            if requested_headers:
                response.headers["Access-Control-Allow-Headers"] = requested_headers
            response.headers["Access-Control-Allow-Methods"] = request.headers.get("access-control-request-method", "POST")
        else:
            try:
                response = await call_next(request)
            except Exception:
                response = Response(status_code=500, content="Internal Server Error")

        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"

        return response

app.add_middleware(CORSRreflectMiddleware)

app.include_router(tenants.router)
app.include_router(crawl.router)
app.include_router(chat.router)
app.include_router(sources.router)
app.include_router(faqs.router)
app.include_router(text_docs.router)
app.include_router(leads.router)
app.include_router(admin.router)

# Mount widget dist directory
os.makedirs("../widget/dist", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="../widget/dist"), name="static")

@app.get("/")
def root():
    return {"message": "API is running. Widget at /static/widget.js"}

@app.on_event("startup")
async def ensure_lookup_indexes():
    await db.parents.create_index([("tenant_id", 1), ("parent_id", 1)])
    await db.parents.create_index([("tenant_id", 1), ("source_id", 1)])
    await db.chunks.create_index([("tenant_id", 1), ("parent_id", 1), ("child_index", 1)])
    await db.chunks.create_index([("tenant_id", 1), ("source_id", 1)])
    await db.pages.create_index([("tenant_id", 1), ("url", 1)])
    await db.pages.create_index([("tenant_id", 1), ("source_id", 1)])
    await db.visitors.create_index("session_id")
    await db.tenants.create_index("tenant_id", unique=True)
    await db.tenants.create_index("api_key", unique=True)
    await db.tenants.create_index("domain")
    await db.conversations.create_index("session_id")
    await db.crawl_jobs.create_index([("job_id", 1), ("tenant_id", 1)])
    await db.sources.create_index([("tenant_id", 1), ("source_id", 1)])
    await db.faqs.create_index([("tenant_id", 1), ("source_id", 1), ("faq_id", 1)])
    await db.documents.create_index([("tenant_id", 1), ("source_id", 1), ("doc_id", 1)])
    await db.leads.create_index([("tenant_id", 1), ("created_at", -1)])
