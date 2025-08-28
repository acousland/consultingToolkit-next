"""Brand consistency and graphic design endpoints."""
import os
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from ..services.brand_consistency import ingest_style_guide, ingest_deck, analyse_brand_consistency

router = APIRouter(prefix="/brand", tags=["Brand"])


class StyleGuideIngestResponse(BaseModel):
    style_guide_id: str
    rules: List[Dict[str, Any]]
    summary: str
    characters: int


class DeckIngestResponse(BaseModel):
    deck_id: str
    slides: List[Dict[str, Any]]
    total_slides: int


class BrandAnalysisRequest(BaseModel):
    style_guide_id: str
    deck_id: str
    selected_slides: Optional[List[int]] = None


class BrandSlideResult(BaseModel):
    slide_number: int
    score: int
    issues: List[str]
    adherence: List[str]
    recommendations: List[str]
    image_path: str


class BrandAnalysisSummary(BaseModel):
    average_score: float
    slides_evaluated: int
    style_guide_rules: int
    style_guide_id: str
    deck_id: str


class BrandAnalysisResponse(BaseModel):
    results: List[BrandSlideResult]
    summary: BrandAnalysisSummary
    rules: List[Dict[str, Any]]


@router.post("/style-guide", response_model=StyleGuideIngestResponse)
async def brand_style_guide_ingest(file: UploadFile = File(...)):
    """Ingest a style guide PDF and extract brand rules."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF style guides supported")
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
        
    try:
        result = ingest_style_guide(path, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Style guide ingestion failed: {e}")
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


@router.post("/deck", response_model=DeckIngestResponse)
async def brand_deck_ingest(file: UploadFile = File(...)):
    """Ingest a deck (PDF presentation) for brand consistency analysis."""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF decks supported")
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        path = tmp.name
        
    try:
        result = ingest_deck(path, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deck ingestion failed: {e}")
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass


@router.post("/analyse", response_model=BrandAnalysisResponse)
async def brand_analyse(payload: BrandAnalysisRequest):
    """Analyze brand consistency between uploaded style guide and deck."""
    try:
        result = analyse_brand_consistency(
            payload.style_guide_id, 
            payload.deck_id, 
            payload.selected_slides
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brand analysis failed: {e}")
