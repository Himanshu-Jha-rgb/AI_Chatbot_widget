import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, BackgroundTasks

from core.auth import db, get_current_tenant, verify_api_key
from models.schemas import EnquirySubmit, LeadResponse
from services.embedder import openai_client

router = APIRouter(tags=["leads"])

_SUMMARIZE_PROMPT = (
    "Summarize the following conversation into one concise sentence "
    "capturing what the visitor was interested in or asking about. "
    "Keep it under 200 characters. Focus on the product/service they were enquiring about."
)


async def _summarize_context(context: str) -> str:
    """Summarize conversation context into a short description."""
    if not context or len(context.strip()) < 10:
        return ""
    try:
        resp = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SUMMARIZE_PROMPT},
                {"role": "user", "content": context},
            ],
            max_tokens=100,
            temperature=0.0,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        # If summarization fails, fall back to first 200 chars of raw context
        return context.strip()[:200]


@router.post("/leads", response_model=LeadResponse)
async def submit_lead(req: EnquirySubmit, background_tasks: BackgroundTasks, current_tenant: dict = Depends(verify_api_key)):
    """Submit an enquiry form lead (from the widget)."""
    tenant_id = current_tenant["tenant_id"]

    # Summarize the conversation context
    summary = await _summarize_context(req.message or "")

    lead = {
        "lead_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "session_id": req.session_id,
        "name": req.name,
        "email": req.email,
        "phone": req.phone or "",
        "message": summary,
        "raw_context": req.message or "",
        "source_url": "",
        "created_at": datetime.now(timezone.utc),
    }

    await db.leads.insert_one(lead)

    webhook_url = current_tenant.get("webhook_url")
    if webhook_url:
        background_tasks.add_task(_send_webhook, webhook_url, lead)

    return LeadResponse(success=True, message="Thank you! We'll get back to you soon.")

async def _send_webhook(url: str, data: dict):
    payload = {
        "lead_id": data["lead_id"],
        "name": data["name"],
        "email": data["email"],
        "phone": data["phone"],
        "message": data["message"],
        "created_at": data["created_at"].isoformat(),
        "source_url": data["source_url"]
    }
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload, timeout=5.0)
    except Exception as e:
        print(f"Failed to send webhook to {url}: {e}")


@router.get("/dashboard/leads")
async def list_leads(current_tenant: dict = Depends(get_current_tenant)):
    """List all leads for the tenant (from the dashboard)."""
    tenant_id = current_tenant["tenant_id"]

    cursor = db.leads.find(
        {"tenant_id": tenant_id},
        {"_id": 0},
    ).sort("created_at", -1)

    leads = await cursor.to_list(length=None)
    return leads
