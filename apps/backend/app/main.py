from dotenv import load_dotenv

# Load environment variables from a local .env file if present
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.ai import router as ai_router
from . import config
from .middleware import RequestLoggingMiddleware, MaxUploadSizeMiddleware

app = FastAPI(title="Consulting Toolkit API", version=config.backend_version())

origins = config.allowed_origins()
app.add_middleware(CORSMiddleware,
                   allow_origins=origins if origins != ["*"] else ["*"],
                   allow_credentials=True,
                   allow_methods=["*"],
                   allow_headers=["*"],)

# Custom middlewares
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(MaxUploadSizeMiddleware)

app.include_router(ai_router)

@app.get("/health")
def health():
    """Health check including backend version and build metadata for UI footer debugging."""
    return {
        "status": "ok",
        **config.as_dict(),
    }

@app.get("/version")
def version():
    return config.as_dict()
