"""LLM management and health check endpoints."""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.llm_resilient import llm_service

router = APIRouter(prefix="/llm", tags=["LLM"])


class LLMStatus(BaseModel):
    enabled: bool
    provider: str
    model: str
    temperature: float


class LLMHealthResponse(BaseModel):
    healthy: bool
    model: str
    response_preview: str = None
    error: str = None


@router.get("/status", response_model=LLMStatus)
def llm_status():
    """Report whether an LLM is configured and which model is selected."""
    config = llm_service.configs["default"]
    return {
        "enabled": llm_service.is_available("default"),
        "provider": "openai" if llm_service.api_key else "none",
        "model": config.model,
        "temperature": config.temperature,
    }


@router.get("/health", response_model=LLMHealthResponse)
async def llm_health():
    """Test if the configured LLM can accept requests."""
    health_result = await llm_service.health_check("default")
    
    if not health_result["healthy"]:
        raise HTTPException(
            status_code=503, 
            detail=health_result.get("error", "LLM health check failed")
        )
    
    return health_result
