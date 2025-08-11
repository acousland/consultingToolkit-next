import os
import asyncio
from typing import Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")
PAIN_POINT_MODEL = os.getenv("PAIN_POINT_MODEL", "gpt-5-mini")  # Upgraded to GPT-5-mini
CONFIGURED_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", 0.2))

def _supports_arbitrary_temperature(model: str) -> bool:
    # GPT-5 models may have specific temperature requirements
    # For now, assume GPT-5-mini supports configurable temperature
    if "gpt-5-mini" in (model or "").lower():
        return True
    # Other GPT-5 models might require default temperature
    return "gpt-5" not in (model or "").lower()

EFFECTIVE_TEMPERATURE = CONFIGURED_TEMPERATURE if _supports_arbitrary_temperature(MODEL) else 1.0

api_key = os.getenv("OPENAI_API_KEY")
try:
    llm = ChatOpenAI(model=MODEL, temperature=EFFECTIVE_TEMPERATURE) if api_key else None
    # Specialized LLM for pain point analysis (can use different model)
    pain_point_llm = ChatOpenAI(
        model=PAIN_POINT_MODEL, 
        temperature=CONFIGURED_TEMPERATURE if _supports_arbitrary_temperature(PAIN_POINT_MODEL) else 1.0
    ) if api_key else None
except Exception:
    llm = None
    pain_point_llm = None

def get_pain_point_llm() -> Optional[ChatOpenAI]:
    """Get the specialized LLM for pain point analysis."""
    return pain_point_llm

async def evaluate_use_cases(description: str) -> Dict[str, Any]:
    prompt = f"""You are an AI use case evaluator. Provide a concise 1-2 paragraph assessment and a 1-100 score for feasibility, impact, and strategic alignment.

Use Case:
{description}

Return strict JSON with keys: feasibility, impact, alignment, rationale."""
    if llm is None:
        base = min(90, 40 + len(description) % 50)
        scores = {"feasibility": base - 10, "impact": base, "alignment": base - 5}
        return {"rationale": "LLM disabled; returning placeholder.", **scores}
    msg = await asyncio.get_event_loop().run_in_executor(None, llm.invoke, [HumanMessage(content=prompt)])
    return {"rationale": msg.content}

async def ethics_review(description: str) -> Dict[str, Any]:
    prompt = f"""You are an ethics reviewer. Provide concise assessments (2-3 sentences each) with 1-10 ratings for: deontological, utilitarian, social_contract, virtue. Then give an overall recommendation.

Use Case:
{description}

Return strict JSON with keys: deontological, utilitarian, social_contract, virtue, recommendation."""
    if llm is None:
        return {"summary": "LLM disabled; placeholder ethics review."}
    msg = await asyncio.get_event_loop().run_in_executor(None, llm.invoke, [HumanMessage(content=prompt)])
    return {"summary": msg.content}
