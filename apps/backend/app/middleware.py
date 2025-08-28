"""Custom middleware utilities (logging, size limits)."""
from __future__ import annotations

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from . import config


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
