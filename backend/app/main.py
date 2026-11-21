from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.APP_DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["root"])
def root() -> dict:
    return {
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "version": app.version,
        "docs": "/docs",
        "api": "/api/v1",
    }


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
