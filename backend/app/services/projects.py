"""Project deletion removes only its confined files after metadata commit."""

import logging
import shutil

from fastapi import HTTPException

from sqlalchemy import select

from app.artifacts.storage import storage
from app.core.errors import api_error
from app.models.entities import Backup, PipelineRun

logger = logging.getLogger("xaiflow.projects")


def delete_project(session, project):
    if session.scalar(
        select(PipelineRun.id).where(
            PipelineRun.project_id == project.id, PipelineRun.status.in_(["running", "queued"])
        )
    ):
        raise api_error(409, "RUN_IN_PROGRESS", "Wait for runs to finish before deleting their project.")
    backups = [
        (item.id, item.path)
        for item in session.scalars(select(Backup).where(Backup.project_id == project.id))
    ]
    project_key = f"projects/{project.id}"
    project_path = storage.resolve(project_key)
    if project_path != storage.root / project_key:
        raise api_error(
            409,
            "UNSAFE_PROJECT_STORAGE",
            "The project storage directory contains an unexpected symbolic link.",
        )
    session.delete(project)
    session.commit()
    try:
        if project_path.exists():
            shutil.rmtree(project_path)
    except OSError:
        logger.exception("Metadata for project %s was deleted; its filesystem cleanup failed.", project.id)
    for backup_id, key in backups:
        try:
            expected = f"backups/{backup_id}.zip"
            path = storage.resolve(key)
            if key != expected or path != storage.root / expected:
                logger.error(
                    "Skipped unsafe backup cleanup for project %s, backup %s.", project.id, backup_id
                )
                continue
            path.unlink(missing_ok=True)
        except (OSError, HTTPException):
            logger.exception("Backup file cleanup failed for project %s, backup %s.", project.id, backup_id)
