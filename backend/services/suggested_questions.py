import json
import time
from services.embedder import openai_client
from core.auth import db


# Simple debounce: don't regenerate if done within last 5 minutes
_last_regeneration: dict[str, float] = {}
REGENERATION_COOLDOWN = 300  # 5 minutes


async def generate_suggested_questions(tenant_id: str, domain: str, industry: str = None) -> list[str]:
    """Generate suggested questions based on the tenant's indexed content.
    
    Args:
        tenant_id: The tenant's UUID
        domain: The tenant's domain name
        industry: The tenant's industry (optional, for context)
    
    Returns:
        List of 3-5 suggested questions
    """
    # Get sample content from the tenant's pages
    pages = await db.pages.find(
        {"tenant_id": tenant_id},
        {"title": 1, "content": 1}
    ).limit(5).to_list(length=5)
    
    if not pages:
        return _get_default_questions(industry, domain)
    
    # Build a summary of available content
    content_summary = []
    for page in pages:
        title = page.get("title", "Untitled")
        content = page.get("content", "")[:500]  # First 500 chars
        content_summary.append(f"Page: {title}\n{content}...")
    
    combined_content = "\n\n".join(content_summary)
    
    industry_context = f"for a {industry} business" if industry else ""
    
    prompt = f"""Based on the following website content for {domain} {industry_context}, generate exactly 3-5 suggested questions that a visitor might want to ask.

Website Content:
{combined_content}

Requirements:
- Questions should be specific to the actual content above
- Mix of different types: product/service inquiries, pricing, support, general questions
- Questions should be natural and conversational
- Questions should be in English
- Return ONLY a JSON array of strings, no other text

Example format: ["What services do you offer?", "How much does it cost?", "How can I contact support?"]"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates suggested questions for chatbots. Always return only a JSON array of strings."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        result = response.choices[0].message.content.strip()
        
        # Parse the JSON array
        if result.startswith("```"):
            result = result.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        questions = json.loads(result)
        
        if isinstance(questions, list) and len(questions) > 0:
            return questions[:5]  # Max 5 questions
        
    except Exception as e:
        print(f"Error generating suggested questions: {e}")
    
    # Fallback to default questions
    return _get_default_questions(industry, domain)


def _get_default_questions(industry: str = None, domain: str = "") -> list[str]:
    """Get default suggested questions based on industry."""
    defaults = {
        "ecommerce": [
            "What products do you offer?",
            "What are your shipping options?",
            "How can I return an item?",
            "Do you have any current promotions?",
            "How can I track my order?"
        ],
        "saas": [
            "What features does your product offer?",
            "How much does it cost?",
            "Do you offer a free trial?",
            "What integrations do you support?",
            "How do I get started?"
        ],
        "healthcare": [
            "What services do you provide?",
            "How can I book an appointment?",
            "Do you accept my insurance?",
            "What are your visiting hours?",
            "Where are you located?"
        ],
        "education": [
            "What programs do you offer?",
            "What are the admission requirements?",
            "How much is the tuition?",
            "Do you offer scholarships?",
            "What is the campus life like?"
        ],
        "real-estate": [
            "What properties do you have available?",
            "What are the prices in this area?",
            "How can I schedule a viewing?",
            "What neighborhoods do you serve?",
            "Do you help with home loans?"
        ],
        "finance": [
            "What financial services do you offer?",
            "How can I open an account?",
            "What are your interest rates?",
            "Do you offer investment advice?",
            "How can I contact a financial advisor?"
        ],
        "legal": [
            "What legal services do you provide?",
            "How much does a consultation cost?",
            "How can I schedule a meeting?",
            "What areas of law do you specialize in?",
            "Do you offer free initial consultations?"
        ],
        "travel-hospitality": [
            "What destinations do you offer?",
            "What are your best travel packages?",
            "How can I book a trip?",
            "Do you offer group discounts?",
            "What is your cancellation policy?"
        ],
        "default": [
            "What services do you offer?",
            "How can I contact you?",
            "What are your business hours?",
            "Where are you located?",
            "How much does it cost?"
        ]
    }
    
    return defaults.get(industry, defaults["default"])


async def update_tenant_suggested_questions(tenant_id: str, domain: str, industry: str = None) -> list[str]:
    """Generate and store suggested questions for a tenant.
    
    Args:
        tenant_id: The tenant's UUID
        domain: The tenant's domain name
        industry: The tenant's industry (optional)
    
    Returns:
        List of generated questions
    """
    # Check cooldown to avoid excessive regeneration
    now = time.time()
    last_run = _last_regeneration.get(tenant_id, 0)
    if now - last_run < REGENERATION_COOLDOWN:
        # Return existing questions if available
        tenant = await db.tenants.find_one({"tenant_id": tenant_id})
        if tenant and tenant.get("suggested_questions"):
            return tenant["suggested_questions"]
    
    _last_regeneration[tenant_id] = now
    
    questions = await generate_suggested_questions(tenant_id, domain, industry)
    
    # Store in tenant document
    await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"suggested_questions": questions}}
    )
    
    return questions
