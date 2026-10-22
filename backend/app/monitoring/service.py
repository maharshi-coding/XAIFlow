"""Distribution monitoring uses logged raw features and the training dataset."""

from collections import Counter
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sqlalchemy import select

from app.core.errors import api_error
from app.models.entities import Alert, Dataset, MonitoringMetric, PredictionLog, RegisteredModel
from app.services.common import get_record
from app.services.alerts import alert_payload, upsert_incident
from app.services.datasets import json_frame, read_dataset


def population_stability_index(baseline: pd.Series, observed: pd.Series) -> float:
    """PSI with baseline quantile bins and explicit unseen categorical buckets."""
    if len(observed) == 0 or len(baseline) == 0:
        return 0.0
    if pd.api.types.is_numeric_dtype(baseline):
        clean = pd.to_numeric(baseline, errors="coerce").dropna().to_numpy(dtype=float)
        current = pd.to_numeric(observed, errors="coerce").dropna().to_numpy(dtype=float)
        if not len(clean) or not len(current):
            return float(abs(baseline.isna().mean() - observed.isna().mean()))
        edges = np.unique(np.quantile(clean, np.linspace(0, 1, 11)))
        if len(edges) < 3:
            value = float(np.mean(clean))
            width = max(abs(value) * 0.05, 1e-6)
            edges = np.array([-np.inf, value - width, value + width, np.inf])
        else:
            edges[0], edges[-1] = -np.inf, np.inf
        expected = np.histogram(clean, bins=edges)[0] / len(clean)
        actual = np.histogram(current, bins=edges)[0] / len(current)
    else:
        expected_counts = baseline.fillna("<missing>").astype(str).value_counts(normalize=True)
        actual_counts = observed.fillna("<missing>").astype(str).value_counts(normalize=True)
        categories = expected_counts.index.union(actual_counts.index)
        expected, actual = (
            expected_counts.reindex(categories, fill_value=0).to_numpy(),
            actual_counts.reindex(categories, fill_value=0).to_numpy(),
        )
    expected, actual = np.clip(expected, 1e-5, 1), np.clip(actual, 1e-5, 1)
    return round(float(np.sum((actual - expected) * np.log(actual / expected))), 6)


def deployment_monitoring(session, deployment, persist=False):
    model = get_record(session, RegisteredModel, deployment.model_id)
    logs = session.scalars(
        select(PredictionLog)
        .where(PredictionLog.deployment_id == deployment.id)
        .order_by(PredictionLog.created_at.desc())
        .limit(500)
    ).all()
    successful = [log for log in logs if not log.error]
    current_rows = [row for log in successful[:50] for row in log.inputs][-2000:]
    predictions = [prediction for log in successful for prediction in log.predictions]
    current = pd.DataFrame(current_rows)
    features = []
    baseline = None
    if model.dataset_id:
        dataset = session.get(Dataset, model.dataset_id)
        if dataset:
            baseline = read_dataset(dataset).drop(
                columns=[dataset.target_column] if dataset.target_column else []
            )
    if baseline is not None and len(current):
        for column in baseline:
            if column not in current:
                continue
            expected, actual = baseline[column], current[column]
            numeric = pd.api.types.is_numeric_dtype(expected)
            psi = population_stability_index(expected, actual)
            features.append(
                {
                    "feature": str(column),
                    "psi": psi,
                    "drifted": psi > deployment.drift_threshold,
                    "baseline_mean": float(expected.mean())
                    if numeric and pd.notna(expected.mean())
                    else None,
                    "current_mean": float(pd.to_numeric(actual, errors="coerce").mean())
                    if numeric and pd.notna(pd.to_numeric(actual, errors="coerce").mean())
                    else None,
                    "baseline_missing": float(expected.isna().mean()),
                    "current_missing": float(actual.isna().mean()),
                }
            )
    labelled = [
        (str(label), str(prediction))
        for log in successful
        if log.labels
        for label, prediction in zip(log.labels, log.predictions)
    ]
    accuracy = (
        sum(label == prediction for label, prediction in labelled) / len(labelled) if labelled else None
    )
    baseline_accuracy = model.metrics.get("accuracy")
    degradation = (
        max(0, baseline_accuracy - accuracy)
        if baseline_accuracy is not None and accuracy is not None
        else None
    )
    drift_score = max((feature["psi"] for feature in features), default=0)
    result = {
        "deployment_id": deployment.id,
        "model_id": model.id,
        "model_name": model.name,
        "model_version": model.version,
        "status": deployment.status,
        "request_count": len(logs),
        "prediction_count": len(predictions),
        "error_count": sum(bool(log.error) for log in logs),
        "error_rate": sum(bool(log.error) for log in logs) / len(logs) if logs else 0,
        "avg_latency_ms": sum(log.latency_ms for log in logs) / len(logs) if logs else 0,
        "prediction_distribution": dict(Counter(str(item) for item in predictions)),
        "drift_score": drift_score,
        "drift_threshold": deployment.drift_threshold,
        "features": features,
        "accuracy": accuracy,
        "labelled_count": len(labelled),
        "baseline_accuracy": baseline_accuracy,
        "degradation": degradation,
        "degradation_threshold": deployment.degradation_threshold,
        "sample_count": len(current),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
    if persist:
        session.add(
            MonitoringMetric(project_id=deployment.project_id, deployment_id=deployment.id, data=result)
        )
        breaches = []
        if drift_score > deployment.drift_threshold:
            breaches.append(
                (
                    "data_drift",
                    "Feature distribution drift detected",
                    f"Maximum feature PSI {drift_score:.3f} exceeds {deployment.drift_threshold:.3f}.",
                    {
                        "drift_score": drift_score,
                        "features": features,
                        "metric": "maximum_feature_psi",
                        "threshold": deployment.drift_threshold,
                        "observed_value": drift_score,
                    },
                )
            )
        if degradation is not None and degradation > deployment.degradation_threshold:
            breaches.append(
                (
                    "model_degradation",
                    "Prediction accuracy degraded",
                    f"Accuracy has decreased by {degradation:.1%} from the training baseline.",
                    {
                        "accuracy": accuracy,
                        "baseline_accuracy": baseline_accuracy,
                        "degradation": degradation,
                        "metric": "accuracy_degradation",
                        "threshold": deployment.degradation_threshold,
                        "observed_value": degradation,
                    },
                )
            )
        for kind, title, message, details in breaches:
            upsert_incident(
                session,
                project_id=deployment.project_id,
                deployment_id=deployment.id,
                kind=kind,
                source=f"deployment:{deployment.id}",
                title=title,
                message=message,
                details=details,
            )
        session.commit()
    result["history"] = [
        {**item.data, "id": item.id, "created_at": item.created_at}
        for item in reversed(
            session.scalars(
                select(MonitoringMetric)
                .where(MonitoringMetric.deployment_id == deployment.id)
                .order_by(MonitoringMetric.created_at.desc())
                .limit(100)
            ).all()
        )
    ]
    result["alerts"] = [
        alert_payload(item)
        for item in session.scalars(
            select(Alert).where(Alert.deployment_id == deployment.id).order_by(Alert.created_at.desc())
        ).all()
    ]
    return result


def simulation_rows(session, deployment, shift):
    model = get_record(session, RegisteredModel, deployment.model_id)
    if not model.dataset_id:
        raise api_error(409, "BASELINE_MISSING", "Simulation requires the original dataset.")
    dataset = get_record(session, Dataset, model.dataset_id)
    frame = (
        read_dataset(dataset)
        .drop(columns=[dataset.target_column] if dataset.target_column else [])
        .head(100)
        .copy()
    )
    numeric = frame.select_dtypes(include="number").columns
    if not len(numeric):
        raise api_error(422, "NO_NUMERIC_FEATURES", "Controlled shift requires at least one numeric feature.")
    for column in numeric:
        deviation = float(frame[column].std())
        frame[column] = frame[column] + shift * (deviation if np.isfinite(deviation) and deviation > 0 else 1)
    return json_frame(frame)
