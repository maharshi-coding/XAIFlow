from contextlib import asynccontextmanager
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api import backups, datasets, deployments, models, monitoring, pipelines, projects, runs, system
from app.core.config import settings
from app.services.execution import recover_interrupted_runs


@asynccontextmanager
async def lifespan(_app):
    if settings.auto_migrate:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(config, "head")
    recover_interrupted_runs()
    yield


app = FastAPI(
    title="XAIFlow",
    version="1.0.0",
    description="Visual machine learning orchestration, explainability and model operations.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)
for router in (
    projects.router,
    datasets.router,
    pipelines.router,
    runs.router,
    models.router,
    deployments.router,
    monitoring.router,
    backups.router,
    system.router,
):
    app.include_router(router, prefix="/api/v1")
app.add_api_route("/health", system.health, methods=["GET"], tags=["System"])


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": [
                    {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
                    for error in exc.errors()
                ],
            }
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_error(_request: Request, _exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "detail": {
                "code": "CONFLICT",
                "message": "The record conflicts with existing application metadata.",
            }
        },
    )


@app.exception_handler(Exception)
async def internal_error(_request: Request, exc: Exception):
    logging.getLogger("xaiflow.api").error("Unhandled API exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": "The service could not complete this request. Inspect the backend logs for details.",
            }
        },
    )
