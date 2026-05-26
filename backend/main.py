from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import tenants, crawl, chat
from core.config import settings
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.auth import limiter
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="Chatbot Widget SaaS")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production use settings.ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tenants.router)
app.include_router(crawl.router)
app.include_router(chat.router)

# Mount widget dist directory
os.makedirs("../widget/dist", exist_ok=True)
app.mount("/static", StaticFiles(directory="../widget/dist"), name="static")

@app.get("/")
def root():
    return {"message": "API is running. Widget at /static/widget.js"}
