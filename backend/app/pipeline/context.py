from dataclasses import dataclass, field
from pathlib import Path
import pandas as pd
import numpy as np


@dataclass
class DataContext:
    dataset_id: str
    frame: pd.DataFrame
    target_column: str
    plan: list[dict] = field(default_factory=list)
    split_parameters: dict | None = None
    train_index: list | None = None
    test_index: list | None = None


@dataclass
class ModelContext:
    training_node_id: str
    dataset_id: str
    bundle: dict
    bundle_path: str
    train_features: np.ndarray
    test_features: np.ndarray
    test_target: np.ndarray
    metrics: dict = field(default_factory=dict)
    explanations: list[dict] = field(default_factory=list)
    registration: dict | None = None


@dataclass
class ExecutionContext:
    artifact_dir: Path
    dataset_resolver: object
    on_log: object
    on_register: object = None
    on_deploy: object = None
    artifacts: list[dict] = field(default_factory=list)
    registrations: list[dict] = field(default_factory=list)
    deployments: list[dict] = field(default_factory=list)

    def artifact(self, path, kind, name=None):
        item = {"path": str(path), "kind": kind, "name": name or Path(path).name}
        self.artifacts.append(item)
        return item
