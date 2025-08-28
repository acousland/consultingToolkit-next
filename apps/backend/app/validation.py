"""Input validation utilities and common validators."""
import re
from typing import Any, Dict, List, Optional, Union
from fastapi import HTTPException
from pydantic import BaseModel, Field, validator


class ErrorDetail(BaseModel):
    """Standard error response format."""
    error: str
    details: Optional[str] = None
    field: Optional[str] = None
    code: Optional[str] = None


class ValidationError(BaseModel):
    """Validation error response format."""
    message: str = "Validation failed"
    errors: List[ErrorDetail]


def validate_file_size(content: bytes, max_size: int = 10 * 1024 * 1024) -> None:
    """Validate uploaded file size."""
    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {max_size // (1024*1024)}MB"
        )


def validate_file_type(filename: str, allowed_extensions: List[str]) -> None:
    """Validate file extension."""
    if not filename or not any(filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )


def validate_text_length(text: str, min_length: int = 1, max_length: int = 50000, field_name: str = "text") -> None:
    """Validate text length constraints."""
    if len(text) < min_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} too short. Minimum length: {min_length} characters"
        )
    if len(text) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} too long. Maximum length: {max_length} characters"
        )


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_positive_number(value: Union[int, float], field_name: str = "value") -> None:
    """Validate that a number is positive."""
    if value <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a positive number"
        )


def validate_score_range(score: Union[int, float], min_score: int = 0, max_score: int = 100, field_name: str = "score") -> None:
    """Validate score is within expected range."""
    if not (min_score <= score <= max_score):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be between {min_score} and {max_score}"
        )


def validate_list_not_empty(items: List[Any], field_name: str = "items") -> None:
    """Validate that a list is not empty."""
    if not items:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} cannot be empty"
        )


class PaginationParams(BaseModel):
    """Standard pagination parameters."""
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    limit: int = Field(default=20, ge=1, le=100, description="Number of items per page")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class BaseResponse(BaseModel):
    """Base response model with common fields."""
    success: bool = True
    timestamp: Optional[str] = None
    
    class Config:
        """Pydantic config."""
        json_encoders = {
            # Add custom encoders if needed
        }


def create_error_response(message: str, details: Optional[str] = None, status_code: int = 400) -> HTTPException:
    """Create standardized error response."""
    return HTTPException(
        status_code=status_code,
        detail={
            "error": message,
            "details": details,
            "code": f"ERR_{status_code}"
        }
    )


def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
    """Validate that all required fields are present and non-empty."""
    missing_fields = []
    empty_fields = []
    
    for field in required_fields:
        if field not in data:
            missing_fields.append(field)
        elif not data[field] or (isinstance(data[field], str) and not data[field].strip()):
            empty_fields.append(field)
    
    if missing_fields or empty_fields:
        error_parts = []
        if missing_fields:
            error_parts.append(f"Missing fields: {', '.join(missing_fields)}")
        if empty_fields:
            error_parts.append(f"Empty fields: {', '.join(empty_fields)}")
        
        raise HTTPException(
            status_code=400,
            detail="; ".join(error_parts)
        )
