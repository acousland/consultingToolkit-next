"""Rate limiting and security middleware for API protection."""
import time
from typing import Dict, Optional
from collections import defaultdict, deque
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket based rate limiter."""
    
    def __init__(self, max_requests: int = 100, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.clients: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if client is within rate limits."""
        now = time.time()
        client_requests = self.clients[client_id]
        
        # Remove old requests outside the time window
        while client_requests and client_requests[0] <= now - self.time_window:
            client_requests.popleft()
        
        # Check if under limit
        if len(client_requests) < self.max_requests:
            client_requests.append(now)
            return True
        
        return False
    
    def get_remaining(self, client_id: str) -> int:
        """Get remaining requests for client."""
        now = time.time()
        client_requests = self.clients[client_id]
        
        # Remove old requests
        while client_requests and client_requests[0] <= now - self.time_window:
            client_requests.popleft()
        
        return max(0, self.max_requests - len(client_requests))
    
    def get_reset_time(self, client_id: str) -> Optional[int]:
        """Get timestamp when rate limit resets for client."""
        client_requests = self.clients[client_id]
        if client_requests:
            return int(client_requests[0] + self.time_window)
        return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce API rate limiting."""
    
    def __init__(
        self, 
        app, 
        max_requests: int = 100, 
        time_window: int = 60,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.rate_limiter = RateLimiter(max_requests, time_window)
        self.exclude_paths = exclude_paths or ["/health", "/version", "/ping"]
        
    def get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Check for API key first
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api_key:{api_key}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        
        # Consider X-Forwarded-For for reverse proxy setups
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Use the first IP in the chain
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        client_id = self.get_client_id(request)
        
        if not self.rate_limiter.is_allowed(client_id):
            # Rate limit exceeded
            remaining = self.rate_limiter.get_remaining(client_id)
            reset_time = self.rate_limiter.get_reset_time(client_id)
            
            logger.warning(f"Rate limit exceeded for client {client_id} on {request.url.path}")
            
            headers = {
                "X-RateLimit-Limit": str(self.rate_limiter.max_requests),
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(reset_time) if reset_time else "",
                "Retry-After": str(self.rate_limiter.time_window)
            }
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "details": f"Maximum {self.rate_limiter.max_requests} requests per {self.rate_limiter.time_window} seconds",
                    "retry_after": self.rate_limiter.time_window
                },
                headers=headers
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        remaining = self.rate_limiter.get_remaining(client_id)
        reset_time = self.rate_limiter.get_reset_time(client_id)
        
        response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        if reset_time:
            response.headers["X-RateLimit-Reset"] = str(reset_time)
        
        return response


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware for API key authentication (optional)."""
    
    def __init__(
        self, 
        app, 
        required_paths: list = None, 
        valid_api_keys: list = None
    ):
        super().__init__(app)
        self.required_paths = required_paths or []
        self.valid_api_keys = set(valid_api_keys or [])
        
    async def dispatch(self, request: Request, call_next):
        # Check if path requires API key
        path_requires_key = any(
            request.url.path.startswith(path) for path in self.required_paths
        )
        
        if not path_requires_key:
            return await call_next(request)
        
        # Check for API key
        api_key = request.headers.get("X-API-Key")
        
        if not api_key:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "API key required",
                    "details": "Please provide a valid API key in X-API-Key header"
                }
            )
        
        if api_key not in self.valid_api_keys:
            logger.warning(f"Invalid API key attempted: {api_key[:10]}...")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Invalid API key",
                    "details": "The provided API key is not valid"
                }
            )
        
        # Valid API key, proceed
        return await call_next(request)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """Middleware to restrict access to specific IP ranges (optional)."""
    
    def __init__(self, app, allowed_ips: list = None, allowed_networks: list = None):
        super().__init__(app)
        self.allowed_ips = set(allowed_ips or [])
        self.allowed_networks = allowed_networks or []
        
    def _ip_in_network(self, ip: str, network: str) -> bool:
        """Check if IP is in CIDR network range."""
        try:
            import ipaddress
            return ipaddress.ip_address(ip) in ipaddress.ip_network(network)
        except (ImportError, ValueError):
            return False
    
    def _is_ip_allowed(self, ip: str) -> bool:
        """Check if IP is in allowed list or networks."""
        if ip in self.allowed_ips:
            return True
            
        for network in self.allowed_networks:
            if self._ip_in_network(ip, network):
                return True
                
        return False
    
    async def dispatch(self, request: Request, call_next):
        if not self.allowed_ips and not self.allowed_networks:
            # No restrictions configured
            return await call_next(request)
        
        client_ip = request.client.host if request.client else "unknown"
        
        # Check X-Forwarded-For for reverse proxy setups  
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        if not self._is_ip_allowed(client_ip):
            logger.warning(f"Access denied for IP: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Access denied", 
                    "details": "Your IP address is not authorized to access this resource"
                }
            )
        
        return await call_next(request)
