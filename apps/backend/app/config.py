"""Central configuration module for the Consulting Toolkit backend.

All environment access and tweakable constants concentrated here to
enable easier testing and future layering (e.g. config files, vaults).
"""
from __future__ import annotations

from functools import lru_cache
from typing import List
import os


@lru_cache(maxsize=1)
def _env(name: str, default: str | None = None) -> str | None:
    return os.getenv(name, default)


@lru_cache(maxsize=1)
def backend_version() -> str:
    return _env("BACKEND_VERSION", "0.1.3") or "0.1.3"


@lru_cache(maxsize=1)
def git_commit() -> str:
    return _env("GIT_COMMIT", "dev") or "dev"


@lru_cache(maxsize=1)
def build_time() -> str:
    import datetime
    return _env("BUILD_TIME", datetime.datetime.utcnow().isoformat() + "Z")


@lru_cache(maxsize=1)
def allowed_origins() -> List[str]:
    raw = _env("CORS_ALLOW_ORIGINS", "*") or "*"
    return [o.strip() for o in raw.split(",") if o.strip()]


# Limits / performance tuning
MAX_UPLOAD_BYTES = int(_env("MAX_UPLOAD_BYTES", "10485760"))  # 10MB default
MAX_ROWS_DEFAULT = int(_env("MAX_ROWS", "5000"))

# LLM configuration
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # Default to available model
TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))

# Rate limiting configuration
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # seconds

# Security configuration
API_KEYS = os.getenv("API_KEYS", "").split(",") if os.getenv("API_KEYS") else []
ALLOWED_IPS = os.getenv("ALLOWED_IPS", "").split(",") if os.getenv("ALLOWED_IPS") else []


def as_dict() -> dict:
    return {
        "backend_version": backend_version(),
        "git_commit": git_commit(),
        "build_time": build_time(),
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_rows_default": MAX_ROWS_DEFAULT,
        "openai_model": OPENAI_MODEL,
        "temperature": TEMPERATURE,
    }
