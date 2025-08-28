"""Custom middleware utilities (logging, size limits, error handling)."""
from __future__ import annotations

import time
import logging
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from . import config

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start = time.perf_counter()
        path = request.url.path
        try:
            response: Response = await call_next(request)
            return response
        finally:
            duration = (time.perf_counter() - start) * 1000
            # Lightweight structured line
            print(f"REQ path={path} method={request.method} status={getattr(response,'status_code','?')} dur_ms={duration:.1f}")


class MaxUploadSizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        # Only enforce on POST/PUT with potential body
        if request.method in {"POST", "PUT", "PATCH"}:
            cl = request.headers.get("content-length")
            if cl and cl.isdigit():
                if int(cl) > config.MAX_UPLOAD_BYTES:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=413, detail="Payload too large")
        return await call_next(request)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware to handle and standardize error responses."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        try:
            return await call_next(request)
            
        except HTTPException as e:
            # HTTPException is already handled by FastAPI, just pass through
            raise
            
        except ValueError as e:
            logger.warning(f"Validation error on {request.url.path}: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Validation error",
                    "details": str(e),
                    "type": "validation_error"
                }
            )
            
        except FileNotFoundError as e:
            logger.error(f"File not found on {request.url.path}: {str(e)}")
            return JSONResponse(
                status_code=404,
                content={
                    "error": "Resource not found", 
                    "details": str(e),
                    "type": "file_not_found"
                }
            )
            
        except TimeoutError as e:
            logger.error(f"Timeout on {request.url.path}: {str(e)}")
            return JSONResponse(
                status_code=408,
                content={
                    "error": "Request timeout",
                    "details": str(e), 
                    "type": "timeout_error"
                }
            )
            
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Unhandled exception on {request.url.path}: {str(e)}", exc_info=True)
            
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "details": "An unexpected error occurred. Please contact support if this persists.",
                    "type": "internal_error"
                }
            )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses."""
    
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Add API version header
        response.headers["X-API-Version"] = config.backend_version()
        
        return response
