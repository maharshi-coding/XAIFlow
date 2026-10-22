"""Signed, bounded project packages with full UUID and artifact-path remapping."""

from datetime import datetime, timezone
import hashlib
import hmac
from io import BytesIO
import json
import os
from pathlib import PurePosixPath
import secrets
import shutil
import stat
from uuid import UUID, uuid4
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile

from fastapi.encoders import jsonable_encoder
from sqlalchemy import inspect, select

from app.artifacts.storage import storage
from app.core.config import settings
from app.core.errors import api_error
from app.models.entities import (
    Alert,
    Artifact,
    Backup,
    Dataset,
    Deployment,
    Explanation,
    Metric,
    ModelVersion,
    MonitoringMetric,
    NodeRun,
    Pipeline,
    PipelineRun,
    PredictionLog,
    Project,
    RegisteredModel,
)
from app.services.common import get_record, serialize

TABLES = [
    Project,
    Dataset,
    Pipeline,
    PipelineRun,
    NodeRun,
    Metric,
    Artifact,
    Explanation,
    RegisteredModel,
    ModelVersion,
    Deployment,
    PredictionLog,
    MonitoringMetric,
    Alert,
]
TABLE_BY_NAME = {model.__tablename__: model for model in TABLES}


def signing_key():
    configured = os.getenv("BACKUP_SIGNING_KEY")
    if configured:
        return configured.encode()
    path = storage.root / ".backup-signing-key"
    if not path.exists():
        try:
            with path.open("x") as stream:
                stream.write(secrets.token_hex(32))
            path.chmod(0o600)
        except FileExistsError:
            pass
    return path.read_bytes().strip()


def canonical_manifest(manifest):
    return json.dumps(
        {key: value for key, value in manifest.items() if key != "signature"},
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()


def collect_records(session, project_id):
    project = get_record(session, Project, project_id)
    rows = {"projects": [serialize(project)]}
    run_ids = list(session.scalars(select(PipelineRun.id).where(PipelineRun.project_id == project_id)))
    model_ids = list(
        session.scalars(select(RegisteredModel.id).where(RegisteredModel.project_id == project_id))
    )
    for model in TABLES[1:]:
        if hasattr(model, "project_id"):
            query = select(model).where(model.project_id == project_id)
        elif model in (NodeRun, Metric):
            query = select(model).where(model.run_id.in_(run_ids))
        else:
            query = select(model).where(model.model_id.in_(model_ids))
        rows[model.__tablename__] = [serialize(item) for item in session.scalars(query)]
    return jsonable_encoder(rows)


def create_backup(session, project_id):
    project = get_record(session, Project, project_id)
    if session.scalar(
        select(PipelineRun.id).where(
            PipelineRun.project_id == project_id, PipelineRun.status.in_(["running", "queued"])
        )
    ):
        raise api_error(
            409, "RUN_IN_PROGRESS", "Wait for current runs to finish before creating a consistent backup."
        )
    rows = collect_records(session, project_id)
    project_root = storage.resolve(f"projects/{project_id}")
    files = {}
    if project_root.exists():
        for path in sorted(project_root.rglob("*")):
            if path.is_file():
                key = storage.key(path)
                files[f"files/{path.relative_to(project_root).as_posix()}"] = {
                    "key": key,
                    "absolute_path": str(path),
                    "checksum": storage.checksum(key),
                    "size_bytes": path.stat().st_size,
                }
    total = sum(item["size_bytes"] for item in files.values())
    if total > settings.max_backup_bytes * 2 or len(files) > 5000:
        raise api_error(413, "BACKUP_TOO_LARGE", "Project artifacts exceed backup limits.")
    manifest = {
        "format": "xaiflow-project",
        "version": 1,
        "project_id": project_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tables": rows,
        "files": files,
        "backup_history": [
            serialize(item, exclude=("path",))
            for item in session.scalars(select(Backup).where(Backup.project_id == project_id))
        ],
    }
    manifest = jsonable_encoder(manifest)
    manifest["signature"] = hmac.new(signing_key(), canonical_manifest(manifest), hashlib.sha256).hexdigest()
    backup_id = str(uuid4())
    key = f"backups/{backup_id}.zip"
    path = storage.resolve(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, allow_nan=False))
        for name, item in files.items():
            archive.write(storage.resolve(item["key"]), name)
    backup = Backup(
        id=backup_id,
        project_id=project_id,
        name=f"{project.name}-backup.zip",
        path=key,
        checksum=storage.checksum(key),
        size_bytes=path.stat().st_size,
        summary={
            "records": {name: len(items) for name, items in rows.items()},
            "artifacts": len(files),
            "artifact_bytes": total,
        },
    )
    session.add(backup)
    session.commit()
    return backup


def validate_archive(content):
    if len(content) > settings.max_backup_bytes:
        raise api_error(413, "BACKUP_TOO_LARGE", "Backup upload exceeds the configured size limit.")
    try:
        archive = ZipFile(BytesIO(content))
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(entries) > 5001 or len(names) != len(set(names)):
            raise ValueError("Archive contains too many files or duplicate entries.")
        if sum(item.file_size for item in entries) > settings.max_backup_bytes * 2:
            raise ValueError("Expanded archive exceeds the size limit.")
        for entry in entries:
            parts = PurePosixPath(entry.filename)
            if (
                parts.is_absolute()
                or ".." in parts.parts
                or "\\" in entry.filename
                or stat.S_ISLNK(entry.external_attr >> 16)
                or entry.flag_bits & 1
            ):
                raise ValueError("Archive contains unsafe, encrypted, or symbolic-link entries.")
        info = archive.getinfo("manifest.json")
        if info.file_size > 20 * 1024 * 1024:
            raise ValueError("Manifest is too large.")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("format") != "xaiflow-project" or manifest.get("version") != 1:
            raise ValueError("Unsupported backup format.")
        expected_signature = hmac.new(signing_key(), canonical_manifest(manifest), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(str(manifest.get("signature", "")), expected_signature):
            raise ValueError(
                "Backup signature is invalid. Use a package from this instance, or configure its BACKUP_SIGNING_KEY for migration."
            )
        expected_names = {"manifest.json", *manifest["files"]}
        if set(names) != expected_names:
            raise ValueError("Archive file list does not match its manifest.")
        project_id = manifest["project_id"]
        UUID(project_id)
        tables = manifest["tables"]
        if (
            set(tables) != set(TABLE_BY_NAME)
            or len(tables["projects"]) != 1
            or tables["projects"][0]["id"] != project_id
        ):
            raise ValueError("Backup must contain exactly one complete project.")
        ids = {}
        for name, rows in tables.items():
            if not isinstance(rows, list) or len(rows) > 200000:
                raise ValueError("Invalid record list.")
            model = TABLE_BY_NAME[name]
            fields = {column.key for column in inspect(model).columns}
            ids[name] = set()
            for row in rows:
                if set(row) != fields or row["id"] in ids[name]:
                    raise ValueError("Unknown fields, missing fields, or duplicate record IDs.")
                UUID(row["id"])
                ids[name].add(row["id"])
                if "project_id" in row and row["project_id"] != project_id:
                    raise ValueError("Backup contains unrelated project records.")
        for name, rows in tables.items():
            for column in inspect(TABLE_BY_NAME[name]).columns:
                for foreign_key in column.foreign_keys:
                    referenced_table = foreign_key.column.table.name
                    for row in rows:
                        value = row[column.key]
                        if value is not None and value not in ids[referenced_table]:
                            raise ValueError("Backup contains an invalid or cross-project relationship.")
        for name, item in manifest["files"].items():
            if not name.startswith("files/") or not item["key"].startswith(f"projects/{project_id}/"):
                raise ValueError("Backup contains an unrelated artifact path.")
            file = archive.read(name)
            if len(file) != item["size_bytes"] or hashlib.sha256(file).hexdigest() != item["checksum"]:
                raise ValueError("Artifact checksum verification failed.")
        return archive, manifest
    except (BadZipFile, ValueError, TypeError, KeyError, OSError, json.JSONDecodeError) as exc:
        raise api_error(422, "INVALID_BACKUP", str(exc)) from exc


def remap_nested(value, mapping):
    if isinstance(value, dict):
        return {mapping.get(key, key): remap_nested(item, mapping) for key, item in value.items()}
    if isinstance(value, list):
        return [remap_nested(item, mapping) for item in value]
    if isinstance(value, str):
        prefix, separator, record_id = value.partition(":")
        if (
            separator
            and prefix in {"project", "pipeline", "run", "model", "deployment"}
            and record_id in mapping
        ):
            return f"{prefix}:{mapping[record_id]}"
        return mapping.get(value, value)
    return value


def restore_backup(session, content):
    archive, manifest = validate_archive(content)
    rows = manifest["tables"]
    mapping = {item["id"]: str(uuid4()) for records in rows.values() for item in records}
    new_project_id = mapping[manifest["project_id"]]
    project_root = storage.resolve(f"projects/{new_project_id}")
    try:
        for name, item in manifest["files"].items():
            key = f"projects/{new_project_id}/{name.removeprefix('files/')}"
            path = storage.put(key, archive.read(name))
            mapping[item["key"]], mapping[item["absolute_path"]] = key, str(path)
        for model in TABLES:
            for original in rows[model.__tablename__]:
                row = remap_nested(original, mapping)
                if model is Project:
                    row["name"] = f"{row['name'][:145]} (restored)"
                for column in inspect(model).columns:
                    if isinstance(column.type, type(Project.created_at.type)) and row[column.key]:
                        row[column.key] = datetime.fromisoformat(row[column.key])
                session.add(model(**row))
            session.flush()
        session.commit()
        project = session.get(Project, new_project_id)
        return {
            "project": serialize(project),
            "restored_records": {name: len(items) for name, items in rows.items()},
            "restored_artifacts": len(manifest["files"]),
            "source_project_id": manifest["project_id"],
            "backup_history": remap_nested(manifest.get("backup_history", []), mapping),
        }
    except Exception:
        session.rollback()
        if project_root.exists():
            shutil.rmtree(project_root)
        raise
    finally:
        archive.close()
