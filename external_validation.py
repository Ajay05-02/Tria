"""Multi-centre external validation (v3): does a basic-input CAD model work at hospitals it never saw?

Mirrors the Colab notebook "Multi-centre model (v3)", cells 2-6.

Data: Tehran (Z-Alizadeh Sani, UCI #411, 303 patients) plus UCI Heart Disease (#45, 920 patients from
Cleveland, Budapest, Zurich/Basel and Long Beach). Both define CAD as >=50% narrowing on angiography.
Only 7 inputs exist in both, so this "core" model is separate from the app's full 55-input model.

Pre-registered before any result was seen (PREREG below):
  inputs      age, sex, chest pain type, resting BP, cholesterol (0 = missing), fasting sugar > 120, resting ECG;
              no missing-value indicators (missingness reveals the hospital, e.g. no Swiss cholesterol at all)
  validation  leave one hospital out: train on 4 hospitals, test on the 5th, for all 5
  selection   highest mean AUC over the 5 held-out hospitals; if within 0.01, choose the simpler model

Writes reports/external_validation.json, which train.py copies into models/metadata.json for the app.
Runs in under a minute: python external_validation.py
"""
import json
import urllib.request
import zipfile

import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import make_column_transformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.pipeline import ROOT, load_raw

UCI_ZIP = ROOT / "data" / "raw" / "uci_heart_disease.zip"
UCI_URL = "https://archive.ics.uci.edu/static/public/45/heart+disease.zip"
OUT = ROOT / "reports" / "external_validation.json"

UCI_FILES = {"Cleveland": "processed.cleveland.data", "Hungary": "processed.hungarian.data",
             "Switzerland": "processed.switzerland.data", "Long Beach": "processed.va.data"}
UCI_COLS = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
            "thalach", "exang", "oldpeak", "slope", "ca", "thal", "num"]
NUM, BINARY, CAT = ["age", "trestbps", "chol"], ["sex", "fbs"], ["cp", "restecg"]
FOREIGN = ["Cleveland", "Hungary", "Long Beach", "Switzerland"]

PREREG = {
    "inputs": "age, sex, cp, trestbps, chol (0 = missing), fbs, restecg; no missing-value indicators",
    "validation": "leave one hospital out: train on 4 hospitals, test on the 5th, for all 5",
    "candidates": ["Logistic regression", "Random forest", "Gradient boosting"],
    "selection_rule": "highest mean AUC over the 5 held-out hospitals; if within 0.01, choose the simpler model",
}


def yes(s):
    return s.astype(str).str.strip().str.upper().isin(["Y", "1", "YES"]).astype(int)


def build_core_table():
    """Both datasets in UCI coding: 7 shared inputs, the CAD outcome and the hospital."""
    tehran = load_raw()
    t = pd.DataFrame({
        "centre": "Tehran",
        "age": tehran["Age"],
        "sex": tehran["Sex"].astype(str).str.strip().str.lower().eq("male").astype(int),
        # chest pain: 1 typical, 2 atypical, 3 non-anginal, 4 none
        "cp": np.select([yes(tehran["Typical Chest Pain"]) == 1, yes(tehran["Atypical"]) == 1,
                         yes(tehran["Nonanginal"]) == 1], [1, 2, 3], default=4),
        "trestbps": tehran["BP"],
        # no total cholesterol in Tehran: Friedewald estimate LDL + HDL + TG/5
        "chol": tehran["LDL"] + tehran["HDL"] + tehran["TG"] / 5,
        "fbs": (tehran["FBS"] > 120).astype(int),
        # resting ECG: 2 LVH, 1 ST-T abnormality, 0 normal
        "restecg": np.select([yes(tehran["LVH"]) == 1,
                              (yes(tehran["St Elevation"]) + yes(tehran["St Depression"])
                               + yes(tehran["Tinversion"])) > 0], [2, 1], default=0),
        "cad": tehran["Cath"].astype(str).str.strip().str.lower().eq("cad").astype(int),
    })

    if not UCI_ZIP.exists():
        UCI_ZIP.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(UCI_URL, UCI_ZIP)
    with zipfile.ZipFile(UCI_ZIP) as z:
        uci = pd.concat([pd.read_csv(z.open(f), header=None, names=UCI_COLS, na_values="?").assign(centre=name)
                         for name, f in UCI_FILES.items()], ignore_index=True)
    u = uci[["centre", "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg"]].copy()
    u["cad"] = (uci["num"] > 0).astype(int)
    u["chol"] = u["chol"].replace(0, np.nan)          # every Swiss and 49 Long Beach patients: "not measured"
    u["trestbps"] = u["trestbps"].replace(0, np.nan)
    return pd.concat([t, u], ignore_index=True)


def prep():
    return make_column_transformer(
        (make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), NUM),
        (SimpleImputer(strategy="most_frequent"), BINARY),
        (make_pipeline(SimpleImputer(strategy="most_frequent"), OneHotEncoder(handle_unknown="ignore")), CAT))


def make_models():
    return {
        "Logistic regression": make_pipeline(prep(), LogisticRegression(max_iter=1000)),
        "Random forest": make_pipeline(prep(), RandomForestClassifier(
            n_estimators=300, min_samples_leaf=3, random_state=0, n_jobs=-1)),
        "Gradient boosting": make_pipeline(prep(), HistGradientBoostingClassifier(
            max_depth=3, learning_rate=0.05, max_iter=200, random_state=0)),
    }


def boot_ci(y_true, p, rng, n=1000):
    y_true, p = np.asarray(y_true), np.asarray(p)
    aucs = []
    for _ in range(n):
        i = rng.integers(0, len(y_true), len(y_true))
        if y_true[i].min() != y_true[i].max():
            aucs.append(roc_auc_score(y_true[i], p[i]))
    return [round(float(v), 3) for v in np.percentile(aucs, [2.5, 97.5])]


def main():
    core = build_core_table()
    X, y, centre = core[NUM + BINARY + CAT], core["cad"], core["centre"]
    models = make_models()

    # 1) leave one hospital out, all three candidates
    loco = {name: {} for name in models}
    for name, model in models.items():
        for c in centre.unique():
            train, test = centre != c, centre == c
            model.fit(X[train], y[train])
            loco[name][c] = round(float(roc_auc_score(y[test], model.predict_proba(X[test])[:, 1])), 4)
        loco[name]["Mean"] = round(float(np.mean(list(loco[name].values()))), 4)
    best = max(loco, key=lambda m: loco[m]["Mean"])
    chosen = "Logistic regression" if loco[best]["Mean"] - loco["Logistic regression"]["Mean"] <= 0.01 else best
    lr = models[chosen]

    # 2) more data vs Tehran only, and 3) amount vs variety (303 patients drawn from the other 4 hospitals)
    rng = np.random.default_rng(0)
    variety = []
    for c in FOREIGN:
        test = centre == c
        row = {"hospital": c, "n_test": int(test.sum())}
        for key, train in [("tehran_only", centre == "Tehran"), ("other_4", centre != c)]:
            lr.fit(X[train], y[train])
            p = lr.predict_proba(X[test])[:, 1]
            row[key] = {"n_train": int(train.sum()), "auc": round(float(roc_auc_score(y[test], p)), 3),
                        "ci95": boot_ci(y[test], p, rng)}
        others, aucs = np.where(centre != c)[0], []
        for seed in range(20):
            pick = np.random.default_rng(seed).choice(others, size=303, replace=False)
            lr.fit(X.iloc[pick], y.iloc[pick])
            aucs.append(roc_auc_score(y[test], lr.predict_proba(X[test])[:, 1]))
        row["varied_303"] = {"auc_mean": round(float(np.mean(aucs)), 3), "auc_sd": round(float(np.std(aucs)), 3)}
        variety.append(row)

    # 4) calibration-in-the-large per held-out hospital
    calibration = []
    for c in centre.unique():
        train, test = centre != c, centre == c
        lr.fit(X[train], y[train])
        p = lr.predict_proba(X[test])[:, 1]
        calibration.append({"hospital": c, "n": int(test.sum()), "predicted_rate": round(float(p.mean()), 3),
                            "actual_rate": round(float(y[test].mean()), 3),
                            "auc": round(float(roc_auc_score(y[test], p)), 3), "ci95": boot_ci(y[test], p, rng)})

    report = {
        "prereg": PREREG,
        "chosen_model": chosen,
        "hospitals": {c: {"n": int((centre == c).sum()), "cad_rate": round(float(y[centre == c].mean()), 3)}
                      for c in centre.unique()},
        "n_patients": int(len(core)),
        "loco_auc": loco,
        "data_vs_variety": variety,
        "calibration": calibration,
        "versions": {"scikit-learn": sklearn.__version__},
    }
    OUT.write_text(json.dumps(report, indent=2))

    print(pd.DataFrame(loco).round(3))
    print("chosen:", chosen)
    print(pd.DataFrame([{"hospital": r["hospital"], "tehran_only": r["tehran_only"]["auc"],
                         "varied_303": r["varied_303"]["auc_mean"], "other_4": r["other_4"]["auc"]}
                        for r in variety]).to_string(index=False))
    print(pd.DataFrame(calibration)[["hospital", "predicted_rate", "actual_rate", "auc"]].to_string(index=False))
    print(f"Saved {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
