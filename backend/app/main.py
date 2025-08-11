from dotenv import load_dotenv

# Load environment variables from a local .env file if present
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.ai import router as ai_router
import os, datetime

BACKEND_VERSION = "0.1.2"
GIT_COMMIT = os.getenv("GIT_COMMIT", "dev")
BUILD_TIME = os.getenv("BUILD_TIME", datetime.datetime.utcnow().isoformat() + "Z")
app = FastAPI(title="Consulting Toolkit API", version=BACKEND_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)

@app.get("/health")
def health():
    """Health check including backend version and build metadata for UI footer debugging."""
    return {
        "status": "ok",
        "backend_version": BACKEND_VERSION,
        "git_commit": GIT_COMMIT,
        "build_time": BUILD_TIME,
    }
