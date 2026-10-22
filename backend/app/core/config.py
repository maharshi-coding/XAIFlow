"""Environment-backed settings for the academic single-process deployment."""

import os
from collections.abc import Mapping
from pathlib import Path

from pydantic import BaseModel
from sqlalchemy.engine import URL


def database_url_from_environment(environ: Mapping[str, str] | None = None) -> str:
    """Explicit URLs win; component credentials are safely escaped by SQLAlchemy."""
    values = os.environ if environ is None else environ
    if values.get("DATABASE_URL"):
        return values["DATABASE_URL"]
    if values.get("POSTGRES_HOST"):
        return URL.create(
            "postgresql+psycopg",
            username=values.get("POSTGRES_USER", "xaiflow"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values["POSTGRES_HOST"],
            port=int(values.get("POSTGRES_PORT", "5432")),
            database=values.get("POSTGRES_DB", "xaiflow"),
        ).render_as_string(hide_password=False)
    return "sqlite:///./xaiflow.db"


class Settings(BaseModel):
    database_url: str = database_url_from_environment()
    artifact_root: Path = Path(os.getenv("ARTIFACT_ROOT", "../artifacts")).resolve()
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(
        ","
    )
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", "20971520"))
    max_backup_bytes: int = int(os.getenv("MAX_BACKUP_BYTES", "209715200"))
    drift_threshold: float = float(os.getenv("DRIFT_THRESHOLD", "0.2"))
    auto_migrate: bool = os.getenv("AUTO_MIGRATE", "true").lower() == "true"


settings = Settings()
