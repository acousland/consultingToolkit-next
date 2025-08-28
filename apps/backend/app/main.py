from dotenv import load_dotenv

# Load environment variables from a local .env file if present
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.ai import router as ai_router
from .routers.llm import router as llm_router
from .routers.brand import router as brand_router
from .routers.graphic_design import router as graphic_design_router
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

# Include routers
app.include_router(llm_router, prefix="/ai")  # /ai/llm/*
app.include_router(brand_router, prefix="/ai")  # /ai/brand/*
app.include_router(graphic_design_router, prefix="/ai")  # /ai/graphic-design/*
app.include_router(ai_router)  # Legacy routes

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
