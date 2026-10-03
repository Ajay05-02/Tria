"""flowstate web server: serves the dashboard and a small prediction API.

  GET  /api/meta              form layout, thresholds, validation metrics
  GET  /api/patients/{index}  inputs and true labels of a dataset patient (for demos)
  POST /api/predict           probabilities, SHAP explanations and warnings for one patient

Explanations are reported in percentage points of the probability the dashboard shows, so the bars of
panel C add up exactly to (this patient's risk - the average patient's risk). See _rows() and predict().
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

from app.features import (COMPOSITES, ENGINEERED_LABELS, EXPLAIN_GROUPS, FEATURES, GROUPS, HIDDEN_INPUTS,
                          VESSELS as VESSEL_INFO)
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
for m in rf.values():
    m.n_jobs = 1   # one patient at a time: starting a thread pool costs more than it saves
explainers = {t: shap.TreeExplainer(m) for t, m in rf.items()}
# The average patient: the forest's expected score (SHAP base value) and what it calibrates to
BASE_RAW = {t: float(np.ravel(e.expected_value)[-1]) for t, e in explainers.items()}
BASE_CAL = {t: float(apply_platt(platt[t], [BASE_RAW[t]])[0]) for t in rf}

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
# Panel C row that each CAD Consortium term belongs to, and each term's average over the study patients
CADC_ROW = {"Age (per decade)": "Age", "Male sex": "Sex", "Atypical chest pain": "chest_pain",
            "Typical chest pain": "chest_pain", "Diabetes": "DM", "Hypertension": "HTN", "Dyslipidemia": "DLP",
            "Smoker (current or ex)": "smoking"}
CADC_MEANS = {name: float(np.mean([fn(r) for r in PATIENTS_X.to_dict("records")])) for name, fn in CADC_TERMS}

GROUP_OF = {f: g["id"] for g in EXPLAIN_GROUPS for f in g["features"]}
GROUP_INFO = {g["id"]: g for g in EXPLAIN_GROUPS}
EDIT_OVERRIDE = {"BMI": "Weight"}   # BMI is computed from weight and height


def _pct(p):
    return ">99%" if p >= 0.995 else "<1%" if p < 0.005 else f"{round(p * 100)}%"


def _fmt(key, v):
    spec = FEATURES.get(key, {})
    if "options" in spec:
        return spec["options"].get(str(int(round(v))), f"{v:g}")
    if META["input_info"].get(key, {}).get("kind") == "binary":
        return "Yes" if v >= 0.5 else "No"
    digits = 0 if abs(v - round(v)) < 1e-9 or abs(v) >= 100 else 1 if abs(v) >= 10 else 2
    return f"{v:.{digits}f}" + (f" {spec['unit']}" if spec.get("unit") else "")


def _group_text(gid, r, z):
    if gid == "chest_pain":
        return ("Typical angina" if r["Typical Chest Pain"] else "Atypical" if r["Atypical"]
                else "Non-anginal" if r["Nonanginal"] else "None")
    if gid == "smoking":
        return "Current" if r["Current Smoker"] else "Ex-smoker" if r["EX-Smoker"] else "No"
    if gid == "ecg":
        n = int(z["ECG_isch_count"])
        return f"{n} of 5 signs" if n else "None"
    if gid == "ef":
        return f"{r['EF-TTE']:.0f}%"
    if gid == "rwma":
        n = int(r["Region RWMA"])
        return f"{n} region{'s' if n > 1 else ''}" if n else "None"
    if gid == "kidney":
        return f"creatinine {r['CR']:.1f}, eGFR {z['eGFR']:.0f}"
    if gid == "nlr":
        return f"{z['NLR']:.1f}"
    if gid == "bbb":
        return "Left" if r["BBB_LBBB"] else "Right" if r["BBB_RBBB"] else "None"
    return ""


def _rows(sv, r):
    """SHAP values (one per model feature) -> one value per clinical fact, still summing to the same total.

    Related features are summed. The CAD Consortium score is itself made of age, sex, chest pain and risk
    factors, so its value is split among those rows in proportion to how far each term moved the score from
    its average (the Aumann-Shapley rule for a linear score); otherwise chest pain would appear twice."""
    rows = {}
    for f, value in zip(FEATURES_USED, sv):
        if f != "CADC_logit":
            rid = GROUP_OF.get(f, f)
            rows[rid] = rows.get(rid, 0.0) + float(value)
    phi = float(sv[FEATURES_USED.index("CADC_logit")])
    dev = {name: float(fn(r)) - CADC_MEANS[name] for name, fn in CADC_TERMS}
    total = sum(dev.values())
    if abs(total) < 0.25:
        # the terms cancel out: a split would exaggerate both sides, so keep the score as one row
        rows["CADC_logit"] = phi
    else:
        for name, d in dev.items():
            rows[CADC_ROW[name]] = rows.get(CADC_ROW[name], 0.0) + phi * d / total
    return rows


def _row_info(rid, r, z):
    if rid in GROUP_INFO:
        g = GROUP_INFO[rid]
        return g["label"], _group_text(rid, r, z), g["edit"]
    if rid == "CADC_logit":
        return "CAD Consortium score", f"{z['CADC_logit']:.2f} log-odds", "Age"
    return FEATURE_LABELS.get(rid, rid), _fmt(rid, float(z[rid])), EDIT_OVERRIDE.get(rid, rid)


def _slope(t, raw):
    """Change in calibrated probability per unit of raw forest score, between the average patient and this one."""
    base = BASE_RAW[t]
    if abs(raw - base) > 1e-6:
        return (float(apply_platt(platt[t], [raw])[0]) - BASE_CAL[t]) / (raw - base)
    e = 1e-4
    return float(apply_platt(platt[t], [raw + e])[0] - apply_platt(platt[t], [raw - e])[0]) / (2 * e)


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
    "clinical_baseline": META.get("clinical_baseline"),
    "structure": META["structure"],
    "localisation_auc": META.get("localisation_auc"),
    "cad_vessel_rate": META.get("cad_vessel_rate"),
    "heldout_curves": META.get("heldout_curves"),
    "patients": [{"index": int(i), "age": int(PATIENTS_X.loc[i, "Age"]), "sex": int(PATIENTS_X.loc[i, "Sex"]),
                  "labels": {t: int(PATIENTS_Y.loc[i, t]) for t in PATIENTS_Y.columns}}
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

    raw = {t: float(m.predict_proba(Xf)[0, 1]) for t, m in rf.items()}
    p_cad = float(apply_platt(platt["Cath"], [raw["Cath"]])[0])
    result = {"cad": {"probability": p_cad, "threshold": THRESHOLDS["Cath"], "high": p_cad >= THRESHOLDS["Cath"]},
              "vessels": {}, "explanations": {}}
    cond = {}
    for v in VESSELS:
        cond[v] = float(apply_platt(platt[v], [raw[v]])[0])
        p = p_cad * cond[v]
        result["vessels"][v] = {"probability": p, "conditional": cond[v],
                                "threshold": THRESHOLDS[v], "high": p >= THRESHOLDS[v]}

    z = {k: float(Xf.iloc[0][k]) for k in FEATURES_USED}
    for t in ["Cath"] + VESSELS:
        sv, _ = _shap_for_positive(explainers[t], Xf)
        rows = _rows(sv, row)
        if t == "Cath":
            k, base, prob = _slope(t, raw[t]), BASE_CAL["Cath"], p_cad
            points = {rid: x * k for rid, x in rows.items()}
        else:
            # P(artery) = P(CAD) x P(artery | CAD). The change from the average patient splits exactly into a
            # CAD part and an artery part (Shapley split of a product); the artery part goes to the features.
            pc, pcb, q, qb = p_cad, BASE_CAL["Cath"], cond[t], BASE_CAL[t]
            k = _slope(t, raw[t]) * (pc + pcb) / 2
            points = {rid: x * k for rid, x in rows.items()}
            points["cad_risk"] = (pc - pcb) * (q + qb) / 2
            base, prob = pcb * qb, pc * q
        contributions = []
        for rid, pts in sorted(points.items(), key=lambda kv: -abs(kv[1])):
            if rid == "cad_risk":
                label, text, edit = "Overall CAD risk", f"{_pct(p_cad)} here, {_pct(BASE_CAL['Cath'])} typical", "tab:Cath"
            else:
                label, text, edit = _row_info(rid, row, z)
            contributions.append({"id": rid, "label": label, "text": text, "edit": edit, "points": pts})
        result["explanations"][t] = {"base": base, "probability": prob, "contributions": contributions}

    logit_cadc = float(Z["CADC_logit"].iloc[0])
    result["cadc"] = {"logit": logit_cadc, "published_probability": 1 / (1 + math.exp(-logit_cadc)),
                      "terms": [{"label": name, "points": float(fn(row))} for name, fn in CADC_TERMS]}
    result["engineered"] = {k: float(Z[k].iloc[0]) for k in ENGINEERED_LABELS}
    result["warnings"] = warnings
    result["ignored_inputs"] = ignored
    return result


app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")
