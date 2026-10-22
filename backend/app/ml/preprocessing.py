"""Transform plans are fitted only after the split, irrespective of canvas order.

Each step preserves named columns. The fitted object is stored in the inference
bundle so the raw deployment input follows exactly the training transformation.
"""

from dataclasses import dataclass, field
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler, MinMaxScaler
from sklearn.feature_selection import SelectKBest, f_classif

MAX_TRANSFORMED_FEATURES = 512
MAX_PREPROCESS_CELLS = 20_000_000


def normalize_frame(frame: pd.DataFrame, numeric_columns=None) -> pd.DataFrame:
    result = frame.copy()
    if numeric_columns is None:
        numeric_columns = [
            name
            for name in result.columns
            if pd.api.types.is_numeric_dtype(result[name]) and not pd.api.types.is_bool_dtype(result[name])
        ]
    for name in result.columns:
        if name in numeric_columns:
            result[name] = pd.to_numeric(result[name]).astype(float)
        else:
            result[name] = (
                result[name].map(lambda value: np.nan if pd.isna(value) else str(value)).astype(object)
            )
    return result


@dataclass
class FittedStep:
    kind: str
    columns: list[str] = field(default_factory=list)
    numeric: list[str] = field(default_factory=list)
    categorical: list[str] = field(default_factory=list)
    numeric_transformer: object = None
    categorical_transformer: object = None
    transformer: object = None
    output_columns: list[str] = field(default_factory=list)

    def transform(self, frame: pd.DataFrame) -> pd.DataFrame:
        result = frame.copy()
        if self.kind == "impute":
            if self.numeric:
                result[self.numeric] = self.numeric_transformer.transform(result[self.numeric])
            if self.categorical:
                result[self.categorical] = self.categorical_transformer.transform(result[self.categorical])
                for name in self.categorical:
                    result[name] = result[name].map(str).astype(object)
        elif self.kind == "encode":
            if self.categorical:
                encoded = self.transformer.transform(result[self.categorical])
                result = pd.DataFrame(
                    np.column_stack([result[self.numeric].to_numpy(dtype=float), encoded]),
                    columns=self.output_columns,
                    index=result.index,
                )
        elif self.kind == "scale":
            if self.numeric:
                result[self.numeric] = self.transformer.transform(result[self.numeric])
        elif self.kind == "select":
            result = pd.DataFrame(
                self.transformer.transform(result.to_numpy(dtype=float)),
                index=result.index,
                columns=self.output_columns,
            )
        return result


class TabularPreprocessor:
    def __init__(self, plan: list[dict]):
        self.plan = plan
        self.steps: list[FittedStep] = []
        self.feature_names: list[str] = []
        self.raw_columns: list[str] = []
        self.raw_numeric: list[str] = []
        self.training_index: list = []

    @property
    def drops_missing(self):
        return any(
            step["type"] == "impute" and step["parameters"].get("strategy") == "drop" for step in self.plan
        )

    def fit_transform(self, frame: pd.DataFrame, target) -> np.ndarray:
        if frame.shape[0] * frame.shape[1] > MAX_PREPROCESS_CELLS:
            raise ValueError("Preprocessing exceeds the 20 million cell budget. Use fewer rows or features.")
        self.raw_columns = list(frame.columns)
        self.raw_numeric = [
            name
            for name in frame.columns
            if pd.api.types.is_numeric_dtype(frame[name]) and not pd.api.types.is_bool_dtype(frame[name])
        ]
        result = normalize_frame(frame, self.raw_numeric)
        target_series = pd.Series(np.asarray(target), index=frame.index)
        for config in self.plan:
            kind, params = config["type"], config["parameters"]
            numeric = list(result.select_dtypes(include="number").columns)
            categorical = [column for column in result.columns if column not in numeric]
            step = FittedStep(kind=kind, numeric=numeric, categorical=categorical)
            if kind == "impute":
                strategy = params.get("strategy", "median")
                if strategy == "drop":
                    result = result.dropna()
                    if len(result) < 2:
                        raise ValueError("Missing-row removal left insufficient training samples.")
                    self.steps.append(FittedStep(kind="drop"))
                    continue
                if numeric:
                    step.numeric_transformer = SimpleImputer(strategy=strategy, keep_empty_features=True).fit(
                        result[numeric]
                    )
                if categorical:
                    step.categorical_transformer = SimpleImputer(
                        strategy="most_frequent", keep_empty_features=True
                    ).fit(result[categorical])
            elif kind == "encode" and categorical:
                if result[categorical].isna().any().any():
                    raise ValueError("Handle missing categorical values before encoding.")
                if params.get("method", "onehot") == "onehot":
                    step.transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False).fit(
                        result[categorical]
                    )
                    encoded_names = list(step.transformer.get_feature_names_out(categorical))
                else:
                    step.transformer = OrdinalEncoder(
                        handle_unknown="use_encoded_value", unknown_value=-1
                    ).fit(result[categorical])
                    encoded_names = categorical
                step.output_columns = numeric + encoded_names
                if len(step.output_columns) > MAX_TRANSFORMED_FEATURES:
                    raise ValueError(
                        "Encoding exceeds the 512 transformed feature limit. Use ordinal encoding or fewer categories."
                    )
                if len(result) * len(step.output_columns) > MAX_PREPROCESS_CELLS:
                    raise ValueError(
                        "Encoding exceeds the 20 million cell budget. Use fewer rows or ordinal encoding."
                    )
            elif kind == "scale" and numeric:
                scaler = StandardScaler if params.get("method", "standard") == "standard" else MinMaxScaler
                step.transformer = scaler().fit(result[numeric])
            elif kind == "select":
                self._check_numeric(result)
                k = params.get("k", 5)
                if k != "all" and int(k) > result.shape[1]:
                    raise ValueError(
                        f"Feature selection requests {k} features, but only {result.shape[1]} are available."
                    )
                step.transformer = SelectKBest(f_classif, k=k).fit(
                    result.to_numpy(dtype=float), target_series.loc[result.index].to_numpy()
                )
                step.output_columns = list(result.columns[step.transformer.get_support()])
            self.steps.append(step)
            result = step.transform(result)
        self._check_numeric(result)
        self.feature_names = list(result.columns)
        self.training_index = result.index.tolist()
        return result.to_numpy(dtype=np.float64)

    def transform(self, frame: pd.DataFrame) -> np.ndarray:
        return self._transform(frame, allow_drop=False)[0]

    def transform_partition(self, frame: pd.DataFrame):
        """Apply test-partition transforms and return retained indices for targets."""
        return self._transform(frame, allow_drop=True)

    def _transform(self, frame, allow_drop):
        result = normalize_frame(frame[self.raw_columns], self.raw_numeric)
        for step in self.steps:
            if step.kind == "drop":
                if not allow_drop and result.isna().any().any():
                    raise ValueError(
                        "This model used missing-row removal. Inference requires complete feature values at that stage."
                    )
                result = result.dropna()
            else:
                result = step.transform(result)
        self._check_numeric(result)
        return result.to_numpy(dtype=np.float64), result.index.tolist()

    @staticmethod
    def _check_numeric(frame):
        nonnumeric = [column for column in frame.columns if not pd.api.types.is_numeric_dtype(frame[column])]
        if nonnumeric:
            raise ValueError(
                f"Categorical features {', '.join(nonnumeric)} need an encoding node before training or selection."
            )
        if frame.shape[1] == 0:
            raise ValueError("At least one feature is required.")
        if not np.isfinite(frame.to_numpy(dtype=float)).all():
            raise ValueError(
                "Features contain missing or nonfinite values. Add missing-value handling before training."
            )
