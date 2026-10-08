"""Train the Tria models (v2), the same recipe as Colab "Model improvement (v2)", Cell 15.

  P(CAD)    = Platt(random forest on 56 features)
  P(vessel) = P(CAD) x Platt(random forest trained on CAD patients only)

The two-step vessel model guarantees P(vessel) <= P(CAD), because a blocked artery means CAD.
Honest performance estimates come from evaluate.py (repeated nested cross-validation),
whose output reports/evaluation_v2.json is copied into models/metadata.json when present, together with
reports/external_validation.json from external_validation.py (the five-hospital check of a basic-input model)
and reports/clinical_baseline.json from clinical_baseline.py (Tria against the ESC 2019 and CAD Consortium scores).

Run:  python train.py   (about 20 seconds)
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from app.features import FEATURES, KEY_INPUTS, QUESTION_INPUTS, input_columns
from app.pipeline import (ENGINEERED, RARE_COLS, REDUNDANT_COLS, ROOT, VESSELS, add_clinical_features,
                          apply_platt, fit_platt, load_raw, make_rf, model_features, pick_threshold, preprocess)

PROCESSED = ROOT / "data" / "processed"
MODELS = ROOT / "models"
EVALUATION = ROOT / "reports" / "evaluation_v2.json"
EXTERNAL = ROOT / "reports" / "external_validation.json"   # written by external_validation.py
CLINICAL = ROOT / "reports" / "clinical_baseline.json"     # written by clinical_baseline.py


def input_set_auc(X, y, features, keep, seeds=(100, 101, 102)):
    """Held-out CAD AUC when only the `keep` columns are entered and every other input stays at the value the
    blank form starts with (0 for yes/no findings, the study median otherwise), as for a new patient in the app."""
    choice = {k for k, spec in FEATURES.items() if "options" in spec}
    blank = {c: 0.0 if set(X[c].unique()) <= {0, 1} and c not in choice else float(X[c].median()) for c in X.columns}
    aucs = []
    for seed in seeds:
        oof = np.zeros(len(X))
        for tr, te in StratifiedKFold(n_splits=5, shuffle=True, random_state=seed).split(X, y):
            model = make_rf().fit(add_clinical_features(X.iloc[tr])[features], y[tr])
            test = X.iloc[te].copy()
            for c in X.columns:
                if c not in keep:
                    test[c] = blank[c]
            oof[te] = model.predict_proba(add_clinical_features(test)[features])[:, 1]
        aucs.append(roc_auc_score(y, oof))
    return round(float(np.mean(aucs)), 3)


def main():
    X, y = preprocess(load_raw())
    PROCESSED.mkdir(parents=True, exist_ok=True)
    X.to_csv(PROCESSED / "X_features.csv", index=False)
    y.to_csv(PROCESSED / "y_targets.csv", index=False)

    features = model_features(list(X.columns))
    Xf = add_clinical_features(X)[features]
    y_cath = y["Cath"].values
    n = len(Xf)
    print(f"Data: {n} patients, {len(features)} model features")

    MODELS.mkdir(exist_ok=True)
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=100)

    # Overall CAD
    p_oof_raw = cross_val_predict(make_rf(), Xf, y_cath, cv=folds, method="predict_proba")[:, 1]
    platt_cath = fit_platt(p_oof_raw, y_cath)
    p_cad_oof = apply_platt(platt_cath, p_oof_raw)
    thresholds = {"Cath": pick_threshold("Cath", y_cath, p_cad_oof)}
    joblib.dump(make_rf().fit(Xf, y_cath), MODELS / "rf_Cath.joblib")
    joblib.dump(platt_cath, MODELS / "platt_Cath.joblib")

    # Held-out ("never seen") predictions for the example patients shown in the app:
    # each patient is scored by a forest trained on the other 4/5 of the patients
    heldout = {"Cath": p_cad_oof}

    # Vessels, trained on CAD patients only
    cad_idx = np.where(y_cath == 1)[0]
    cond_oof = {}
    for v in VESSELS:
        yv = y[v].values
        cond_oof_raw = np.zeros(n)
        for tr, te in folds.split(Xf, y_cath):
            tr_cad = tr[y_cath[tr] == 1]
            cond_oof_raw[te] = make_rf().fit(Xf.iloc[tr_cad], yv[tr_cad]).predict_proba(Xf.iloc[te])[:, 1]
        platt_v = fit_platt(cond_oof_raw[cad_idx], yv[cad_idx])
        cond_oof[v] = apply_platt(platt_v, cond_oof_raw)
        heldout[v] = p_cad_oof * cond_oof[v]
        thresholds[v] = pick_threshold(v, yv, heldout[v])
        joblib.dump(make_rf().fit(Xf.iloc[cad_idx], yv[cad_idx]), MODELS / f"rf_cond_{v}.joblib")
        joblib.dump(platt_v, MODELS / f"platt_cond_{v}.joblib")

    for t, thr in thresholds.items():
        print(f"  {t}: threshold {thr:.3f}")
    (MODELS / "heldout_predictions.json").write_text(json.dumps(
        [{t: round(float(heldout[t][i]), 4) for t in heldout} for i in range(n)]))

    # The hard part: telling WHICH artery is narrowed. Held-out P(artery | CAD), ranked among CAD patients only
    localisation_auc = {v: round(float(roc_auc_score(y[v].values[cad_idx], cond_oof[v][cad_idx])), 3) for v in VESSELS}
    cad_vessel_rate = {v: round(float(y[v].values[cad_idx].mean()), 4) for v in VESSELS}
    print("  artery-picking AUC among CAD patients:", localisation_auc)

    # How much a user must enter: accuracy with only the key inputs (Table 1 asks for them first)
    input_sets = {
        "note": "held-out CAD ROC-AUC (3 x 5-fold CV) when only these inputs are entered; the rest stay at typical values",
        "questions": {"items": len(QUESTION_INPUTS), "auc": input_set_auc(X, y_cath, features, input_columns(QUESTION_INPUTS))},
        "key": {"items": len(KEY_INPUTS), "auc": input_set_auc(X, y_cath, features, input_columns(KEY_INPUTS))},
        "all": {"auc": input_set_auc(X, y_cath, features, list(X.columns))},
    }
    print("  CAD AUC with only questions / key inputs / all:",
          input_sets["questions"]["auc"], input_sets["key"]["auc"], input_sets["all"]["auc"])

    # ROC and calibration curves of the held-out predictions, drawn in Table 2
    curves = {}
    for t, p in heldout.items():
        yt = y[t].values
        fpr, tpr, _ = roc_curve(yt, p)
        fifths = np.array_split(np.argsort(p), 5)
        curves[t] = {"auc": round(float(roc_auc_score(yt, p)), 3),
                     "roc": [[round(float(a), 3), round(float(b), 3)] for a, b in zip(fpr, tpr)],
                     "calibration": [[round(float(p[i].mean()), 3), round(float(yt[i].mean()), 3), int(len(i))]
                                     for i in fifths]}

    # Everything the web form needs about each of the 55 raw inputs
    input_info = {}
    for c in X.columns:
        vals = X[c]
        input_info[c] = {
            "kind": "binary" if set(vals.unique()) <= {0, 1} else "number",
            "min": float(vals.min()), "max": float(vals.max()), "median": float(vals.median()),
            "used_by_model": c in features,
        }
    Xall = add_clinical_features(X)
    feature_means = {c: float(Xall[c].mean()) for c in features}

    meta = {
        "version": "v2",
        "dataset": "Extension of Z-Alizadeh Sani (UCI Machine Learning Repository, id 411), CC BY 4.0",
        "n_patients": int(n),
        "inputs": list(X.columns),
        "features": features,
        "engineered_features": ENGINEERED,
        "dropped_columns": {"rare (<6 positives)": RARE_COLS, "redundant": REDUNDANT_COLS},
        "targets": list(y.columns),
        "positive_rate": {t: round(float(y[t].mean()), 4) for t in y.columns},
        "thresholds": thresholds,
        "threshold_rules": {"Cath": "highest cut-off with sensitivity >= 0.90 (rule-out)",
                            "vessels": "Youden's J"},
        "structure": "P(CAD) = Platt(RF); P(vessel) = P(CAD) x Platt(RF trained on CAD patients)",
        "input_info": input_info,
        "feature_means": feature_means,
        "model": "RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=42) + Platt scaling",
        "versions": {"scikit-learn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__},
        "evaluation": json.loads(EVALUATION.read_text()) if EVALUATION.exists() else None,
        "external_validation": json.loads(EXTERNAL.read_text()) if EXTERNAL.exists() else None,
        "clinical_baseline": json.loads(CLINICAL.read_text()) if CLINICAL.exists() else None,
        "localisation_auc": localisation_auc,
        "input_sets": input_sets,
        "cad_vessel_rate": cad_vessel_rate,
        "heldout_curves": {"note": "held-out predictions from one stratified 5-fold split (train.py)",
                           "targets": curves},
    }
    (MODELS / "metadata.json").write_text(json.dumps(meta, indent=2))
    print("Saved models/ and models/metadata.json"
          + ("" if EVALUATION.exists() else "  (no reports/evaluation_v2.json yet: run evaluate.py)"))


if __name__ == "__main__":
    main()
