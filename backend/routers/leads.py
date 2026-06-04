import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from core.auth import db, get_current_tenant, verify_api_key
from models.schemas import EnquirySubmit, LeadResponse

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=LeadResponse)
async def submit_lead(req: EnquirySubmit, current_tenant: dict = Depends(verify_api_key)):
    """Submit an enquiry form lead (from the widget)."""
    tenant_id = current_tenant["tenant_id"]

    lead = {
        "lead_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "session_id": req.session_id,
        "name": req.name,
        "email": req.email,
        "phone": req.phone or "",
        "message": req.message or "",
        "source_url": "",
        "created_at": datetime.now(timezone.utc),
    }

    await db.leads.insert_one(lead)

    return LeadResponse(success=True, message="Thank you! We'll get back to you soon.")


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
