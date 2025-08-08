import os
import asyncio
from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
CONFIGURED_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", 0.2))

def _supports_arbitrary_temperature(model: str) -> bool:
    # Some frontier models (e.g., certain gpt-5-* variants) only accept the default temperature (1)
    # Heuristic: treat any 'gpt-5' model as not supporting arbitrary temperatures
    return "gpt-5" not in (model or "").lower()

EFFECTIVE_TEMPERATURE = CONFIGURED_TEMPERATURE if _supports_arbitrary_temperature(MODEL) else 1.0

api_key = os.getenv("OPENAI_API_KEY")
try:
    llm = ChatOpenAI(model=MODEL, temperature=EFFECTIVE_TEMPERATURE) if api_key else None
except Exception:
    llm = None

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
