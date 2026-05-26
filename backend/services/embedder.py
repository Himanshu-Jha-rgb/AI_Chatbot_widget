from openai import AsyncOpenAI
from core.config import settings
from tenacity import retry, stop_after_attempt, wait_exponential

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def embed_text(text: str) -> list[float]:
    response = await openai_client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding
