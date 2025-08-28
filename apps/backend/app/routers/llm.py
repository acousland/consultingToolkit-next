"""LLM management and health check endpoints."""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.llm import llm, EFFECTIVE_TEMPERATURE

router = APIRouter(prefix="/llm", tags=["LLM"])


class LLMStatus(BaseModel):
    enabled: bool
    provider: str
    model: str
    temperature: float


@router.get("/status", response_model=LLMStatus)
def llm_status():
    """Report whether an LLM is configured and which model is selected."""
    # Derive provider/model from env; enabled reflects runtime object availability.
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    temp = float(os.getenv("OPENAI_TEMPERATURE", "0.2") or 0.2)
    # Reflect effective temperature if model only supports default
    eff_temp = EFFECTIVE_TEMPERATURE if llm is not None else temp
    provider = "openai" if os.getenv("OPENAI_API_KEY") else "none"
    return {
        "enabled": llm is not None,
        "provider": provider,
        "model": model,
        "temperature": eff_temp,
    }


@router.get("/health")
async def llm_health():
    """Test if the configured LLM can accept requests."""
    if llm is None:
        raise HTTPException(status_code=503, detail="No LLM configured")
    
    try:
        # Simple test query
        messages = [{"role": "user", "content": "Say OK"}]
        response = await llm.ainvoke(messages)
        if not response or not response.content:
            raise HTTPException(status_code=503, detail="LLM returned empty response")
        return {
            "status": "healthy",
            "test_response": response.content[:50],  # First 50 chars
            "provider": "openai" if os.getenv("OPENAI_API_KEY") else "none"
        }
    except Exception as e:
        raise HTTPException(
            status_code=503, 
            detail=f"LLM health check failed: {str(e)}"
        )
