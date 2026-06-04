from __future__ import annotations

import hashlib
import json
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scipy.stats import spearmanr
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
CACHE_DIR = Path(os.environ.get("PXAI_CACHE_DIR", "/tmp/privacy-xai-cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED = 20260604
MAX_SHAP_ROWS = 240
MAX_ROWS_BY_DATASET = {
    "breast_cancer": 116,
    "cervical_cancer": 858,
    "usa_housing": 1800,
}


app = FastAPI(title="privacy-xai-replication-runner", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    dataset: Literal["breast_cancer", "cervical_cancer", "usa_housing"] = "breast_cancer"
    method: Literal["mdav", "laplace"] = "mdav"
    k: int = Field(default=5, ge=1, le=20)
    noise_scale: float = Field(default=2.0, ge=0.1, le=12.0)
    test_size: float = Field(default=0.25, ge=0.15, le=0.4)
    n_estimators: int = Field(default=120, ge=25, le=300)


@dataclass
class DatasetSpec:
    id: str
    label: str
    task: Literal["classification", "regression"]
    url: str
    target: str
    description: str
    paper_role: str
    source_note: str


DATASETS: dict[str, DatasetSpec] = {
    "breast_cancer": DatasetSpec(
        id="breast_cancer",
        label="Breast Cancer Coimbra",
        task="classification",
        url="https://archive.ics.uci.edu/ml/machine-learning-databases/00451/dataR2.csv",
        target="Classification",
        description="Small tabular medical dataset used in the paper's breast cancer notebooks.",
        paper_role="classification dataset",
        source_note="UCI dataR2.csv",
    ),
    "cervical_cancer": DatasetSpec(
        id="cervical_cancer",
        label="Cervical Cancer Risk Factors",
        task="classification",
        url="https://archive.ics.uci.edu/ml/machine-learning-databases/00383/risk_factors_cervical_cancer.csv",
        target="Biopsy",
        description="Risk-factor table used in the paper's cervical cancer notebooks.",
        paper_role="classification dataset",
        source_note="UCI risk_factors_cervical_cancer.csv; target is Biopsy",
    ),
    "usa_housing": DatasetSpec(
        id="usa_housing",
        label="USA Housing",
        task="regression",
        url="https://huggingface.co/datasets/gusdelact/usa-housing-curated/resolve/main/train.csv",
        target="Price",
        description="USA housing price table matching the paper's housing workflow shape.",
        paper_role="regression dataset",
        source_note="Hugging Face hosted USA housing-compatible train.csv",
    ),
}


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "privacy-xai-replication-runner",
        "datasets": list(DATASETS),
        "methods": ["mdav", "laplace"],
    }


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/datasets")
def datasets() -> dict[str, Any]:
    return {
        "datasets": [
            {
                "id": spec.id,
                "label": spec.label,
                "task": spec.task,
                "description": spec.description,
                "paperRole": spec.paper_role,
                "sourceNote": spec.source_note,
            }
            for spec in DATASETS.values()
        ]
    }


@app.post("/run")
def run(req: RunRequest) -> dict[str, Any]:
    started = time.perf_counter()
    spec = DATASETS[req.dataset]
    try:
        raw = load_dataset(spec)
        prepared = prepare_dataset(spec, raw)
        if prepared.empty:
            raise RuntimeError("Prepared dataset is empty")

        result = run_experiment(spec, prepared, req)
        result["latencyMs"] = round((time.perf_counter() - started) * 1000, 3)
        result["resultHash"] = sha256_json(strip_for_hash(result))
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def load_dataset(spec: DatasetSpec) -> pd.DataFrame:
    cache_path = CACHE_DIR / f"{spec.id}.csv"
    if not cache_path.exists():
        df = pd.read_csv(spec.url)
        df.to_csv(cache_path, index=False)
    return pd.read_csv(cache_path)


def prepare_dataset(spec: DatasetSpec, df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.replace("?", np.nan)

    if spec.id == "usa_housing":
        aliases = {
            "Avg. Area Income": "Avg Area Income",
            "Avg. Area House Age": "Avg Area House Age",
            "Avg. Area Number of Rooms": "Avg Area Number of Rooms",
            "Avg. Area Number of Bedrooms": "Avg Area Number of Bedrooms",
        }
        df = df.rename(columns=aliases)
        if "Address" in df.columns:
            df = df.drop(columns=["Address"])

    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(axis=1, how="all")
    df = df.fillna(df.median(numeric_only=True))

    if spec.id == "breast_cancer":
        df[spec.target] = df[spec.target].astype(int) - 1
    elif spec.task == "classification":
        df[spec.target] = df[spec.target].astype(int)

    max_rows = MAX_ROWS_BY_DATASET[spec.id]
    if len(df) > max_rows:
        df = df.sample(max_rows, random_state=RANDOM_SEED).reset_index(drop=True)
    return df


def run_experiment(spec: DatasetSpec, df: pd.DataFrame, req: RunRequest) -> dict[str, Any]:
    y = df[spec.target]
    X = df.drop(columns=[spec.target])
    feature_names = list(X.columns)
    stratify = y if spec.task == "classification" and y.nunique() > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=req.test_size,
        random_state=RANDOM_SEED,
        stratify=stratify,
    )

    protected_train = protect_dataset(spec, X_train, y_train, req)
    baseline = train_and_explain(spec, X_train, y_train, X_test, y_test, req.n_estimators)
    protected = train_and_explain(
        spec,
        protected_train.drop(columns=[spec.target]),
        protected_train[spec.target],
        X_test,
        y_test,
        req.n_estimators,
    )

    rank_correlation = safe_spearman(baseline["importance"], protected["importance"])
    irregularity = rank_irregularity(baseline["importance"], protected["importance"])
    distortion = normalized_l1(baseline["importance"], protected["importance"])

    dataset_csv = df.to_csv(index=False)
    config = req.model_dump()
    manifest = {
        "schema": "privacy-xai-result-manifest/v1",
        "paper": "Explainable machine learning models with privacy",
        "dataset": spec.id,
        "datasetHash": sha256_text(dataset_csv),
        "config": config,
        "featureNames": feature_names,
        "method": req.method,
    }

    return {
        "schema": "privacy-xai-replication-result/v1",
        "dataset": {
            "id": spec.id,
            "label": spec.label,
            "task": spec.task,
            "rows": int(len(df)),
            "features": len(feature_names),
            "target": spec.target,
            "sourceNote": spec.source_note,
            "hash": manifest["datasetHash"],
        },
        "privacy": privacy_summary(req),
        "baseline": public_model_summary(baseline, feature_names, spec.task),
        "protected": public_model_summary(protected, feature_names, spec.task),
        "comparison": {
            "utilityDelta": round(protected["utility"] - baseline["utility"], 6),
            "rankCorrelation": round(rank_correlation, 6),
            "irregularity": round(irregularity, 6),
            "explanationDistortion": round(distortion, 6),
            "plainEnglish": explain_tradeoff(spec, req, baseline["utility"], protected["utility"], rank_correlation),
        },
        "manifest": {
            **manifest,
            "manifestHash": sha256_json(manifest),
        },
    }


def protect_dataset(spec: DatasetSpec, X: pd.DataFrame, y: pd.Series, req: RunRequest) -> pd.DataFrame:
    if req.method == "mdav":
        return mdav_microaggregate(X, y, req.k, spec.task)
    return laplace_protect(X, y, req.noise_scale, spec.task)


def mdav_microaggregate(
    X: pd.DataFrame,
    y: pd.Series,
    k: int,
    task: Literal["classification", "regression"],
) -> pd.DataFrame:
    if k <= 1:
        return pd.concat([X.reset_index(drop=True), y.reset_index(drop=True)], axis=1)

    scaler = StandardScaler()
    values = scaler.fit_transform(X)
    remaining = list(range(len(values)))
    clusters: list[list[int]] = []

    while len(remaining) >= 3 * k:
        rem = np.array(remaining)
        centroid = values[rem].mean(axis=0)
        xr = rem[np.argmax(np.linalg.norm(values[rem] - centroid, axis=1))]
        xs_candidates = rem[rem != xr]
        xs = xs_candidates[np.argmax(np.linalg.norm(values[xs_candidates] - values[xr], axis=1))]
        cluster_r = nearest_indices(values, remaining, xr, k)
        remaining = [idx for idx in remaining if idx not in cluster_r]
        cluster_s = nearest_indices(values, remaining, xs, k)
        remaining = [idx for idx in remaining if idx not in cluster_s]
        clusters.extend([cluster_r, cluster_s])

    if remaining:
        if len(remaining) < k and clusters:
            clusters[-1].extend(remaining)
        else:
            clusters.append(remaining)

    X_out = X.copy().reset_index(drop=True)
    y_out = y.copy().reset_index(drop=True)
    for cluster in clusters:
        cluster_mean = X_out.iloc[cluster].mean(axis=0).to_numpy()
        X_out.iloc[cluster, :] = np.tile(cluster_mean, (len(cluster), 1))
        if task == "regression":
            y_out.iloc[cluster] = y_out.iloc[cluster].mean()
        else:
            y_out.iloc[cluster] = int(y_out.iloc[cluster].mode().iloc[0])
    return pd.concat([X_out, y_out.rename(y.name)], axis=1)


def nearest_indices(values: np.ndarray, remaining: list[int], center: int, k: int) -> list[int]:
    rem = np.array(remaining)
    distances = np.linalg.norm(values[rem] - values[center], axis=1)
    selected = rem[np.argsort(distances)[: min(k, len(rem))]]
    return [int(idx) for idx in selected]


def laplace_protect(
    X: pd.DataFrame,
    y: pd.Series,
    scale: float,
    task: Literal["classification", "regression"],
) -> pd.DataFrame:
    rng = np.random.default_rng(RANDOM_SEED)
    X_out = X.copy().reset_index(drop=True)
    ranges = X_out.max(axis=0) - X_out.min(axis=0)
    ranges = ranges.replace(0, 1)
    noise = rng.laplace(0.0, scale, size=X_out.shape)
    X_out = X_out + noise * (ranges.to_numpy() / 100.0)
    y_out = y.copy().reset_index(drop=True)
    if task == "regression":
        target_range = max(float(y_out.max() - y_out.min()), 1.0)
        y_out = y_out + rng.laplace(0.0, scale, size=len(y_out)) * (target_range / 100.0)
    return pd.concat([X_out, y_out.rename(y.name)], axis=1)


def train_and_explain(
    spec: DatasetSpec,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    n_estimators: int,
) -> dict[str, Any]:
    if spec.task == "regression":
        model = RandomForestRegressor(
            n_estimators=n_estimators,
            random_state=RANDOM_SEED,
            max_depth=8,
            n_jobs=-1,
        )
    else:
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            random_state=RANDOM_SEED,
            max_depth=8,
            n_jobs=-1,
            class_weight="balanced",
        )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    utility = utility_score(spec.task, y_test, pred)
    secondary = secondary_metric(spec.task, y_test, pred)
    shap_values = tree_shap_importance(model, X_test)
    return {
        "utility": utility,
        "secondary": secondary,
        "importance": normalize_importance(shap_values),
        "modelImportance": normalize_importance(np.asarray(model.feature_importances_, dtype=float)),
    }


def tree_shap_importance(model: Any, X: pd.DataFrame) -> np.ndarray:
    sample = X.sample(min(MAX_SHAP_ROWS, len(X)), random_state=RANDOM_SEED)
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(sample)
    if isinstance(values, list):
        arr = np.stack([np.abs(v).mean(axis=0) for v in values], axis=0).mean(axis=0)
    else:
        raw = np.asarray(values)
        if raw.ndim == 3:
            arr = np.abs(raw).mean(axis=(0, 2))
        else:
            arr = np.abs(raw).mean(axis=0)
    return np.asarray(arr, dtype=float)


def utility_score(task: str, y_true: pd.Series, pred: np.ndarray) -> float:
    if task == "regression":
        return float(r2_score(y_true, pred))
    return float(accuracy_score(y_true, pred))


def secondary_metric(task: str, y_true: pd.Series, pred: np.ndarray) -> dict[str, float]:
    if task == "regression":
        return {"mae": float(mean_absolute_error(y_true, pred))}
    return {"macroF1": float(f1_score(y_true, pred, average="macro", zero_division=0))}


def normalize_importance(values: np.ndarray) -> np.ndarray:
    values = np.maximum(np.asarray(values, dtype=float), 0)
    total = values.sum()
    if not np.isfinite(total) or total <= 0:
        return np.ones_like(values) / max(len(values), 1)
    return values / total


def safe_spearman(a: np.ndarray, b: np.ndarray) -> float:
    corr = spearmanr(a, b).correlation
    if corr is None or not np.isfinite(corr):
        return 0.0
    return float(corr)


def rank_irregularity(a: np.ndarray, b: np.ndarray) -> float:
    rank_a = np.argsort(np.argsort(-a))
    rank_b = np.argsort(np.argsort(-b))
    return float(np.mean(np.abs(rank_a - rank_b)))


def normalized_l1(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.abs(a - b).sum() / 2.0)


def public_model_summary(
    result: dict[str, Any],
    feature_names: list[str],
    task: Literal["classification", "regression"],
) -> dict[str, Any]:
    importance = result["importance"]
    ranked = [
        {
            "feature": feature_names[i],
            "importance": round(float(importance[i]), 6),
            "rank": rank + 1,
        }
        for rank, i in enumerate(np.argsort(-importance))
    ]
    metric_name = "R2" if task == "regression" else "accuracy"
    return {
        "utilityMetric": metric_name,
        "utility": round(float(result["utility"]), 6),
        "secondary": {key: round(float(value), 6) for key, value in result["secondary"].items()},
        "topFeatures": ranked[:10],
        "allFeatureImportances": ranked,
    }


def privacy_summary(req: RunRequest) -> dict[str, Any]:
    if req.method == "mdav":
        return {
            "method": "MDAV microaggregation",
            "parameter": "k",
            "value": req.k,
            "plainEnglish": f"Each record is grouped with nearby records and replaced by a cluster representative. Higher k means stronger anonymity and more distortion.",
        }
    return {
        "method": "Laplace noise",
        "parameter": "noise scale",
        "value": req.noise_scale,
        "plainEnglish": "Numerical columns are perturbed with Laplace noise. Higher scale means stronger masking and less faithful explanations.",
    }


def explain_tradeoff(
    spec: DatasetSpec,
    req: RunRequest,
    baseline_utility: float,
    protected_utility: float,
    rank_corr: float,
) -> str:
    utility_name = "R2" if spec.task == "regression" else "accuracy"
    direction = "kept" if protected_utility >= baseline_utility - 0.03 else "lost"
    return (
        f"The protected {spec.label} model {direction} utility "
        f"({utility_name} {protected_utility:.3f} vs baseline {baseline_utility:.3f}) "
        f"with SHAP rank correlation {rank_corr:.3f}. This is the paper's core tradeoff: "
        "privacy transformation can preserve model behavior while changing what the explanation says."
    )


def strip_for_hash(result: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in result.items() if k not in {"latencyMs", "resultHash"}}


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_json(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), default=json_default).encode("utf-8")
    ).hexdigest()


def json_default(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, float) and math.isnan(value):
        return None
    raise TypeError(f"Not JSON serializable: {type(value)}")
