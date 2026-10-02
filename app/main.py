"""flowstate web server: serves the dashboard and a small prediction API.

  GET  /api/meta              form layout, thresholds, validation metrics
  GET  /api/patients/{index}  inputs and true labels of a dataset patient (for demos)
  POST /api/predict           probabilities, SHAP explanations and warnings for one patient
"""
import json
import math

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.features import COMPOSITES, ENGINEERED_LABELS, FEATURES, GROUPS, HIDDEN_INPUTS, VESSELS as VESSEL_INFO
from app.pipeline import ROOT, VESSELS, add_clinical_features, apply_platt

MODELS = ROOT / "models"
META = json.loads((MODELS / "metadata.json").read_text())
INPUTS = META["inputs"]
FEATURES_USED = META["features"]
THRESHOLDS = META["thresholds"]

rf = {"Cath": joblib.load(MODELS / "rf_Cath.joblib")}
platt = {"Cath": joblib.load(MODELS / "platt_Cath.joblib")}
for v in VESSELS:
    rf[v] = joblib.load(MODELS / f"rf_cond_{v}.joblib")
    platt[v] = joblib.load(MODELS / f"platt_cond_{v}.joblib")
explainers = {t: shap.TreeExplainer(m) for t, m in rf.items()}

PATIENTS_X = pd.read_csv(ROOT / "data" / "processed" / "X_features.csv")
PATIENTS_Y = pd.read_csv(ROOT / "data" / "processed" / "y_targets.csv")
PATIENTS_X["Weight"] = PATIENTS_X["Weight"].round(0)
HELDOUT_FILE = MODELS / "heldout_predictions.json"   # cross-validated predictions, written by train.py
HELDOUT = json.loads(HELDOUT_FILE.read_text()) if HELDOUT_FILE.exists() else None

FEATURE_LABELS = {**{k: v["label"] for k, v in FEATURES.items()}, **ENGINEERED_LABELS}
UNITS = {k: v.get("unit", "") for k, v in FEATURES.items()}
UNITS["eGFR"] = "mL/min/1.73m²"

# CAD Consortium clinical model terms (Genders et al., BMJ 2012), shown as the "points" behind the score
CADC_TERMS = [
    ("Age (per decade)", lambda r: math.log(1.85) / 10 * r["Age"]),
    ("Male sex", lambda r: math.log(3.79) * (r["Sex"] == 1)),
    ("Atypical chest pain", lambda r: math.log(1.88) * r["Atypical"] * (1 - r["Typical Chest Pain"])),
    ("Typical chest pain", lambda r: (math.log(4.91) if r["DM"] == 1 else math.log(7.36)) * r["Typical Chest Pain"]),
    ("Diabetes", lambda r: math.log(2.29) * r["DM"]),
    ("Hypertension", lambda r: math.log(1.40) * r["HTN"]),
    ("Dyslipidemia", lambda r: math.log(1.53) * r["DLP"]),
    ("Smoker (current or ex)", lambda r: math.log(1.59) * ((r["Current Smoker"] + r["EX-Smoker"]) > 0)),
]


def _shap_for_positive(explainer, X):
    sv = explainer.shap_values(X)
    if isinstance(sv, list):
        sv = sv[1]
    elif np.ndim(sv) == 3:
        sv = sv[:, :, 1]
    base = explainer.expected_value
    base = float(base[1]) if np.ndim(base) else float(base)
    return np.asarray(sv)[0], base


def _form_fields():
    fields = []
    for key in INPUTS:
        if key in HIDDEN_INPUTS:
            continue
        spec = FEATURES[key]
        info = META["input_info"][key]
        fields.append({
            "key": key, "label": spec["label"], "unit": spec.get("unit", ""), "group": spec["group"],
            "kind": "select" if "options" in spec else info["kind"], "options": spec.get("options"),
            "step": spec.get("step", 1), "min": info["min"], "max": info["max"], "median": info["median"],
            "used_by_model": info["used_by_model"],
        })
    return fields


META_RESPONSE = {
    "version": META["version"],
    "n_patients": META["n_patients"],
    "groups": GROUPS,
    "fields": _form_fields(),
    "composites": COMPOSITES,
    "vessels": VESSEL_INFO,
    "thresholds": THRESHOLDS,
    "threshold_rules": META["threshold_rules"],
    "positive_rate": META["positive_rate"],
    "evaluation": META.get("evaluation"),
    "external_validation": META.get("external_validation"),
    "structure": META["structure"],
    "patients": [{"index": int(i), "labels": {t: int(PATIENTS_Y.loc[i, t]) for t in PATIENTS_Y.columns}}
                 for i in range(len(PATIENTS_Y))],
}

app = FastAPI(title="flowstate", version=META["version"])


@app.middleware("http")
async def revalidate_static_files(request, call_next):
    # Browsers otherwise keep stale copies of the JS/CSS after an update
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


class PredictRequest(BaseModel):
    inputs: dict[str, float] = {}


@app.get("/api/meta")
def get_meta():
    return META_RESPONSE


@app.get("/api/patients/{index}")
def get_patient(index: int):
    if not 0 <= index < len(PATIENTS_X):
        raise HTTPException(status_code=404, detail=f"patient index must be 0-{len(PATIENTS_X) - 1}")
    return {"index": index,
            "inputs": {k: float(v) for k, v in PATIENTS_X.loc[index].items()},
            "labels": {t: int(PATIENTS_Y.loc[index, t]) for t in PATIENTS_Y.columns},
            "heldout": HELDOUT[index] if HELDOUT else None}


@app.post("/api/predict")
def predict(req: PredictRequest):
    row = {k: META["input_info"][k]["median"] for k in INPUTS}
    ignored = []
    for k, v in req.inputs.items():
        if k not in row:
            ignored.append(k)
        elif not math.isfinite(v):
            raise HTTPException(status_code=422, detail=f"{k} must be a finite number")
        else:
            row[k] = float(v)

    warnings = []
    for k in INPUTS:
        info = META["input_info"][k]
        if info["used_by_model"] and info["kind"] == "number" and not info["min"] <= row[k] <= info["max"]:
            warnings.append(f"{FEATURE_LABELS.get(k, k)} = {row[k]:g} is outside the training data range "
                            f"({info['min']:g} to {info['max']:g}); this prediction is less reliable.")

    Z = add_clinical_features(pd.DataFrame([row])[INPUTS])
    Xf = Z[FEATURES_USED]

    p_cad = float(apply_platt(platt["Cath"], rf["Cath"].predict_proba(Xf)[:, 1])[0])
    result = {"cad": {"probability": p_cad, "threshold": THRESHOLDS["Cath"], "high": p_cad >= THRESHOLDS["Cath"]},
              "vessels": {}, "explanations": {}}
    for v in VESSELS:
        p_cond = float(apply_platt(platt[v], rf[v].predict_proba(Xf)[:, 1])[0])
        p = p_cad * p_cond
        result["vessels"][v] = {"probability": p, "conditional": p_cond,
                                "threshold": THRESHOLDS[v], "high": p >= THRESHOLDS[v]}

    for t in ["Cath"] + VESSELS:
        sv, base = _shap_for_positive(explainers[t], Xf)
        raw = float(rf[t].predict_proba(Xf)[0, 1])
        order = np.argsort(-np.abs(sv))
        result["explanations"][t] = {
            "question": "Why this CAD risk?" if t == "Cath" else f"Why this {t} risk, if CAD is present?",
            "base": base, "score": raw,
            "contributions": [{"feature": FEATURES_USED[i], "label": FEATURE_LABELS.get(FEATURES_USED[i], FEATURES_USED[i]),
                               "value": float(Xf.iloc[0, i]), "unit": UNITS.get(FEATURES_USED[i], ""),
                               "shap": float(sv[i])} for i in order],
        }

    logit_cadc = float(Z["CADC_logit"].iloc[0])
    result["cadc"] = {"logit": logit_cadc, "published_probability": 1 / (1 + math.exp(-logit_cadc)),
                      "terms": [{"label": name, "points": float(fn(row))} for name, fn in CADC_TERMS]}
    result["engineered"] = {k: float(Z[k].iloc[0]) for k in ENGINEERED_LABELS}
    result["warnings"] = warnings
    result["ignored_inputs"] = ignored
    return result


app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")
