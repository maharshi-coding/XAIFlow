from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.datasets import read_upload
from app.artifacts.storage import storage
from app.backups.service import create_backup, restore_backup
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import Backup
from app.schemas.requests import BackupCreate
from app.schemas.responses import BackupOut
from app.services.common import get_record, list_records, serialize

router = APIRouter(prefix="/backups", tags=["Backup and restore"])


def backup_out(backup):
    return {**serialize(backup, exclude=("path",)), "download_url": f"/api/v1/backups/{backup.id}/download"}


@router.get("", response_model=list[BackupOut])
def backups(project_id: str | None = None, db: Session = Depends(get_db)):
    return [backup_out(item) for item in list_records(db, Backup, project_id)]


@router.post("", status_code=201, response_model=BackupOut)
def backup_project(body: BackupCreate, db: Session = Depends(get_db)):
    return backup_out(create_backup(db, body.project_id))


@router.post("/restore", status_code=201)
async def restore_project(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await read_upload(file, settings.max_backup_bytes)
    result = restore_backup(db, content)
    return {"project_id": result["project"]["id"], "id": result["project"]["id"], **result}


@router.get("/{backup_id}/download")
def download_backup(backup_id: str, db: Session = Depends(get_db)):
    backup = get_record(db, Backup, backup_id)
    return FileResponse(
        storage.verified(backup.path, backup.checksum), media_type="application/zip", filename=backup.name
    )
