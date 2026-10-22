"""Uniform model interface with a lazily imported, deterministic CPU PyTorch adapter."""

from abc import ABC, abstractmethod
from pathlib import Path
import random
from functools import wraps
from threading import RLock
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

_TORCH_LOCK = RLock()


def torch_synchronized(method):
    """Prevent concurrent inference network initialization from changing train RNG."""

    @wraps(method)
    def wrapped(*args, **kwargs):
        with _TORCH_LOCK:
            return method(*args, **kwargs)

    return wrapped


def seed_frameworks(seed: int, torch_enabled=False):
    random.seed(seed)
    np.random.seed(seed)
    if torch_enabled:
        import torch

        torch.manual_seed(seed)
        torch.use_deterministic_algorithms(True)
        torch.set_num_threads(1)


class ModelAdapter(ABC):
    training_history: list[dict]

    @abstractmethod
    def fit(self, features, target): ...

    @abstractmethod
    def predict(self, features): ...

    @abstractmethod
    def predict_proba(self, features): ...

    def save(self, path):
        joblib.dump(self, path)

    @staticmethod
    def load(path):
        return joblib.load(path)

    def metadata(self):
        return {
            "model_type": self.model_type,
            "framework": self.framework,
            "hyperparameters": self.parameters,
            "classes": [python_value(x) for x in self.classes_],
        }


def python_value(value):
    return value.item() if isinstance(value, np.generic) else value


class SklearnModelAdapter(ModelAdapter):
    framework = "scikit-learn"

    def __init__(self, model_type, parameters):
        self.model_type, self.parameters = model_type, parameters
        self.training_history = []
        if model_type == "logistic_regression":
            self.estimator = LogisticRegression(**parameters)
        elif model_type == "random_forest":
            self.estimator = RandomForestClassifier(**parameters, n_jobs=1)
        else:
            raise ValueError(f"Unsupported scikit-learn model: {model_type}")

    def fit(self, features, target):
        seed_frameworks(int(self.parameters.get("random_state", 42)))
        self.estimator.fit(features, target)
        self.classes_ = self.estimator.classes_
        return self

    def predict(self, features):
        return self.estimator.predict(features)

    def predict_proba(self, features):
        return self.estimator.predict_proba(features)


class PyTorchModelAdapter(ModelAdapter):
    framework = "pytorch"
    model_type = "pytorch"

    def __init__(self, parameters):
        self.parameters = parameters
        self.training_history = []
        self.network = None

    def _make_network(self):
        import torch.nn as nn

        widths = [self.input_dim] + self.parameters["hidden_dims"]
        layers = []
        for left, right in zip(widths, widths[1:]):
            layers += [nn.Linear(left, right), nn.ReLU(), nn.Dropout(float(self.parameters["dropout"]))]
        layers.append(nn.Linear(widths[-1], len(self.classes_)))
        return nn.Sequential(*layers)

    @torch_synchronized
    def fit(self, features, target):
        import torch

        seed_frameworks(int(self.parameters.get("random_state", 42)), torch_enabled=True)
        self.encoder = LabelEncoder().fit(target)
        self.classes_ = self.encoder.classes_
        self.input_dim = features.shape[1]
        self.network = self._make_network()
        features_t = torch.tensor(np.asarray(features), dtype=torch.float32)
        target_t = torch.tensor(self.encoder.transform(target), dtype=torch.long)
        loader = torch.utils.data.DataLoader(
            torch.utils.data.TensorDataset(features_t, target_t),
            batch_size=int(self.parameters["batch_size"]),
            shuffle=True,
            generator=torch.Generator().manual_seed(int(self.parameters["random_state"])),
        )
        optimizer = torch.optim.Adam(self.network.parameters(), lr=float(self.parameters["learning_rate"]))
        loss_fn = torch.nn.CrossEntropyLoss()
        for epoch in range(int(self.parameters["epochs"])):
            self.network.train()
            total_loss, correct = 0.0, 0
            for batch, labels in loader:
                optimizer.zero_grad()
                logits = self.network(batch)
                loss = loss_fn(logits, labels)
                loss.backward()
                optimizer.step()
                total_loss += float(loss.detach()) * len(batch)
                correct += int((logits.argmax(1) == labels).sum())
            self.training_history.append(
                {"epoch": epoch + 1, "loss": total_loss / len(features), "accuracy": correct / len(features)}
            )
        self.network.eval()
        self.weights = {key: value.detach().numpy() for key, value in self.network.state_dict().items()}
        return self

    @torch_synchronized
    def predict_proba(self, features):
        import torch

        if self.network is None:
            self.network = self._make_network()
            self.network.load_state_dict({key: torch.tensor(value) for key, value in self.weights.items()})
            self.network.eval()
        with torch.no_grad():
            return torch.softmax(
                self.network(torch.tensor(np.asarray(features), dtype=torch.float32)), dim=1
            ).numpy()

    def predict(self, features):
        return self.classes_[self.predict_proba(features).argmax(axis=1)]

    def __getstate__(self):
        state = self.__dict__.copy()
        state["network"] = None
        return state

    def save_weights(self, directory):
        import torch

        path = Path(directory) / "weights.pt"
        torch.save(
            {
                "state_dict": {key: torch.tensor(value) for key, value in self.weights.items()},
                "architecture": {
                    "input_dim": self.input_dim,
                    "hidden_dims": self.parameters["hidden_dims"],
                    "classes": [python_value(value) for value in self.classes_],
                    "dropout": self.parameters["dropout"],
                },
            },
            path,
        )
        return str(path)


def create_adapter(model_type, parameters):
    return (
        PyTorchModelAdapter(parameters)
        if model_type == "pytorch"
        else SklearnModelAdapter(model_type, parameters)
    )
