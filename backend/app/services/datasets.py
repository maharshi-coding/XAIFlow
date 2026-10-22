import csv
from io import StringIO
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.artifacts.storage import storage
from app.core.errors import api_error
from app.models.entities import Dataset, PipelineRun, Project, RegisteredModel
from app.services.common import get_record, serialize


def json_frame(frame: pd.DataFrame):
    clean = frame.replace([np.inf, -np.inf], np.nan)
    return clean.astype(object).where(clean.notna(), None).to_dict(orient="records")


def read_dataset(dataset: Dataset) -> pd.DataFrame:
    path = storage.verified(dataset.path, dataset.checksum)
    return pd.read_csv(path)


def summarize(frame: pd.DataFrame, target: str | None):
    columns = [
        {
            "name": str(name),
            "dtype": str(frame[name].dtype),
            "missing": int(frame[name].isna().sum()),
            "unique": int(frame[name].nunique()),
        }
        for name in frame.columns
    ]
    numeric = frame.select_dtypes(include="number").replace([np.inf, -np.inf], np.nan)
    statistics = {"missing_values": int(frame.isna().sum().sum()), "numeric": {}, "class_distribution": {}}
    for name in numeric:
        described = numeric[name].describe()
        statistics["numeric"][str(name)] = {
            str(key): float(value) if pd.notna(value) else None for key, value in described.items()
        }
    if target:
        statistics["class_distribution"] = {
            str(k): int(v) for k, v in frame[target].value_counts(dropna=False).items()
        }
    return columns, statistics


def upload_dataset(session: Session, project_id: str, filename: str, content: bytes, target: str | None):
    get_record(session, Project, project_id)
    if not filename.lower().endswith(".csv"):
        raise api_error(422, "INVALID_DATASET", "Upload a UTF-8 CSV file.")
    try:
        text = content.decode("utf-8-sig")
        reader = csv.reader(StringIO(text), strict=True)
        header = next(reader)
        if len(header) != len(set(header)) or any(not item.strip() for item in header):
            raise ValueError("Column names must be unique and nonempty.")
        for line_number, row in enumerate(reader, start=2):
            if row and len(row) != len(header):
                raise ValueError(f"CSV row {line_number} has {len(row)} values; expected {len(header)}.")
        frame = pd.read_csv(StringIO(text))
    except (UnicodeDecodeError, ValueError, StopIteration, csv.Error, pd.errors.ParserError) as exc:
        raise api_error(422, "INVALID_CSV", str(exc)) from exc
    if frame.empty or not len(frame.columns):
        raise api_error(422, "EMPTY_DATASET", "CSV must contain a header and data rows.")
    if len(frame) > 200000 or len(frame.columns) > 500:
        raise api_error(413, "DATASET_TOO_LARGE", "Use at most 200,000 rows and 500 columns.")
    if target and target not in frame.columns:
        raise api_error(422, "INVALID_TARGET", "Target column does not exist.")
    dataset_id = str(uuid4())
    key = f"projects/{project_id}/datasets/{dataset_id}.csv"
    storage.put(key, content)
    columns, statistics = summarize(frame, target)
    dataset = Dataset(
        id=dataset_id,
        project_id=project_id,
        name=Path(filename).name[:255],
        path=key,
        checksum=storage.checksum(key),
        target_column=target,
        row_count=len(frame),
        column_count=len(frame.columns),
        columns=columns,
        statistics=statistics,
    )
    session.add(dataset)
    session.commit()
    return detail(dataset, frame)


def detail(dataset: Dataset, frame=None):
    frame = read_dataset(dataset) if frame is None else frame
    return {**serialize(dataset, exclude=("path",)), "preview": json_frame(frame.head(25))}


def update_target(session, dataset, target):
    frame = read_dataset(dataset)
    if target not in frame:
        raise api_error(422, "INVALID_TARGET", "Target column does not exist.")
    if target != dataset.target_column:
        model_reference = session.scalar(
            select(RegisteredModel.id).where(RegisteredModel.dataset_id == dataset.id)
        )
        run_reference = session.scalar(select(PipelineRun.id).where(PipelineRun.dataset_id == dataset.id))
        definitions = session.scalars(
            select(PipelineRun.definition).where(PipelineRun.project_id == dataset.project_id)
        ).all()
        graph_reference = any(
            node.get("parameters", {}).get("dataset_id") == dataset.id
            for definition in definitions
            for node in definition.get("nodes", [])
        )
        if model_reference or run_reference or graph_reference:
            raise api_error(
                409,
                "TARGET_LOCKED",
                "This dataset has been used by an experiment. Its target is locked to preserve reruns and monitoring; upload a new dataset to use another target.",
            )
    dataset.target_column = target
    dataset.columns, dataset.statistics = summarize(frame, target)
    session.commit()
    return detail(dataset, frame)
