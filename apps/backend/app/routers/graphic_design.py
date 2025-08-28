"""Graphic design and presentation review endpoints."""
import os
import tempfile
import shutil
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/graphic-design", tags=["Graphic Design"])


class SlideFeedback(BaseModel):
    overall_score: int
    visual_consistency: str
    typography: str
    color_harmony: str
    layout_balance: str
    suggestions: List[str]


class SlideReview(BaseModel):
    slide_number: int
    image_path: str
    feedback: SlideFeedback


class SlidePreview(BaseModel):
    slide_number: int
    image_path: str


class SlidePreviewResponse(BaseModel):
    slides: List[SlidePreview]


class OverallSummary(BaseModel):
    average_score: float
    key_strengths: List[str]
    priority_improvements: List[str]


class PowerPointReviewResponse(BaseModel):
    presentation_name: str
    total_slides: int
    reviews: List[SlideReview]
    overall_summary: OverallSummary
    mode: Optional[str] = None


@router.post("/powerpoint/preview", response_model=SlidePreviewResponse)
async def preview_powerpoint_slides(presentation: UploadFile = File(...)):
    """Preview PDF presentation pages as images.

    (Legacy path name retained for backward compatibility; now PDF-only.)
    """
    from ..services.powerpoint_review import extract_slides_as_images
    
    if not presentation.filename:
        raise HTTPException(status_code=400, detail="File required")
        
    fname = presentation.filename.lower()
    if not fname.endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail="Only PDF files are supported now. Please export your presentation to PDF."
        )
    
    # Preserve correct extension (.pdf) so downstream detection works
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(presentation.file, tmp_file)
        tmp_path = tmp_file.name
        
    try:
        slide_images = await extract_slides_as_images(tmp_path)
        slides = [
            {
                "slide_number": s["slide_number"],
                "image_path": f"data:image/png;base64,{s['image_base64']}"
            } for s in slide_images
        ]
        return {"slides": slides}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF preview failed: {e}")
    finally:
        os.unlink(tmp_path)


@router.post("/powerpoint/review", response_model=PowerPointReviewResponse)
async def review_powerpoint_presentation(
    presentation: UploadFile = File(...),
    selected_slides: str = Form(None),
    mode: str = Form("presentation_aid", description="presentation_aid or deliverable")
):
    """Review a PDF presentation for visual consistency and design quality (PDF-only)."""
    from ..services.powerpoint_review import review_presentation
    
    if not presentation.filename:
        raise HTTPException(status_code=400, detail="File required")
        
    fname = presentation.filename.lower()
    if not fname.endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail="Only PDF files are supported now. Export your deck to PDF."
        )
        
    # Parse selected pages
    slides_to_review = None
    if selected_slides:
        try:
            import json
            slides_to_review = json.loads(selected_slides)
        except Exception:
            slides_to_review = None
            
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        shutil.copyfileobj(presentation.file, tmp_file)
        tmp_path = tmp_file.name
        
    try:
        result = await review_presentation(
            tmp_path, 
            presentation.filename, 
            slides_to_review, 
            mode=mode
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF review failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
            
    return result
