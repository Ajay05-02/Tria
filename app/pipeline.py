"""Shared data pipeline used by train.py, evaluate.py and the web app, so training and serving always match.

Mirrors the Colab notebook "Model improvement (v2)".
"""
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_curve

ROOT = Path(__file__).resolve().parent.parent
RAW_ZIP = ROOT / "data" / "raw" / "z_alizadeh_sani_extension.zip"
UCI_URL = "https://archive.ics.uci.edu/static/public/411/extention+of+z+alizadeh+sani+dataset.zip"

TARGETS = {"Cath": "CAD", "LAD": "Stenotic", "LCX": "Stenotic", "RCA": "Stenotic"}
VESSELS = ["LAD", "LCX", "RCA"]

# Label-free cleaning, fixed in preregistration.json before any experiment
RARE_COLS = ["CHF", "LowTH Ang", "Weak Peripheral Pulse", "CVA"]   # fewer than 6 positive patients
REDUNDANT_COLS = ["Weight", "Obesity"]                              # BMI = Weight / Height^2; Obesity = BMI >= 25

ENGINEERED = ["CADC_logit", "ECG_isch_count", "EF_lt50", "RWMA_any", "LV_damage", "NLR", "eGFR"]


def load_raw():
    if not RAW_ZIP.exists():
        import urllib.request
        RAW_ZIP.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(UCI_URL, RAW_ZIP)
    with zipfile.ZipFile(RAW_ZIP) as z:
        return pd.read_excel(z.open("extention of Z-Alizadeh sani dataset.xlsx"))


def preprocess(df):
    """Raw spreadsheet -> 55 numeric input columns (X) and 4 binary targets (y)."""
    clean = df.copy()
    clean["Sex"] = clean["Sex"].replace({"Fmale": "Female"}).map({"Female": 0, "Male": 1})
    clean = clean.drop(columns=["Exertional CP"])  # every patient has "N"

    yn_cols = [c for c in clean.columns if set(clean[c].unique()) <= {"N", "Y"}]
    for c in yn_cols:
        clean[c] = clean[c].map({"N": 0, "Y": 1})

    clean["VHD"] = clean["VHD"].map({"N": 0, "mild": 1, "Moderate": 2, "Severe": 3})
    clean = pd.get_dummies(clean, columns=["BBB"], prefix="BBB", dtype=int).drop(columns=["BBB_N"])

    y = pd.DataFrame({t: (clean[t] == positive).astype(int) for t, positive in TARGETS.items()})
    X = clean.drop(columns=list(TARGETS))

    assert X.select_dtypes(exclude="number").empty, "non-numeric input column"
    assert X.isna().sum().sum() == 0, "missing values after conversion"
    assert not set(TARGETS) & set(X.columns), "target leaked into inputs"
    return X, y


def add_clinical_features(df):
    """Seven features from fixed published formulas. Nothing is fitted, so nothing can leak."""
    Z = df.copy()
    male = (Z["Sex"] == 1).astype(int)
    typical = Z["Typical Chest Pain"]
    atypical = Z["Atypical"] * (1 - typical)
    smoker = ((Z["Current Smoker"] + Z["EX-Smoker"]) > 0).astype(int)

    # CAD Consortium clinical model (Genders et al., BMJ 2012)
    Z["CADC_logit"] = (-7.539 + np.log(1.85) / 10 * Z["Age"] + np.log(3.79) * male
                       + np.log(1.88) * atypical
                       + np.where(Z["DM"] == 1, np.log(4.91), np.log(7.36)) * typical
                       + np.log(2.29) * Z["DM"] + np.log(1.40) * Z["HTN"]
                       + np.log(1.53) * Z["DLP"] + np.log(1.59) * smoker)

    Z["ECG_isch_count"] = Z[["Q Wave", "St Elevation", "St Depression", "Tinversion",
                             "Poor R Progression"]].sum(axis=1)
    Z["EF_lt50"] = (Z["EF-TTE"] < 50).astype(int)
    Z["RWMA_any"] = (Z["Region RWMA"] > 0).astype(int)
    Z["LV_damage"] = np.maximum(0, 60 - Z["EF-TTE"]) * Z["Region RWMA"]
    Z["NLR"] = Z["Neut"] / Z["Lymph"]

    # CKD-EPI 2021 race-free creatinine equation
    female = 1 - male
    kappa = np.where(female == 1, 0.7, 0.9)
    alpha = np.where(female == 1, -0.241, -0.302)
    ratio = Z["CR"] / kappa
    Z["eGFR"] = (142 * np.minimum(ratio, 1) ** alpha * np.maximum(ratio, 1) ** -1.200
                 * 0.9938 ** Z["Age"] * np.where(female == 1, 1.012, 1.0))
    return Z


def model_features(input_columns):
    """The 56 model inputs: cleaned original columns (in their original order) + engineered ones."""
    return [c for c in input_columns if c not in RARE_COLS + REDUNDANT_COLS] + ENGINEERED


def make_rf():
    return RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=42, n_jobs=-1)


def logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def fit_platt(p_raw, y_true):
    """Logistic recalibration: a slope and intercept on the log-odds of the raw forest output."""
    return LogisticRegression(C=1e6, max_iter=1000).fit(logit(p_raw).reshape(-1, 1), y_true)


def apply_platt(cal, p_raw):
    return cal.predict_proba(logit(np.asarray(p_raw, dtype=float)).reshape(-1, 1))[:, 1]


def pick_threshold(target, y_true, prob):
    """Cath: highest cut-off that still catches >= 90% of CAD (rule-out). Vessels: Youden's J."""
    fpr, tpr, thr = roc_curve(y_true, prob)
    if target == "Cath":
        return float(min(thr[tpr >= 0.90].max(), 1.0))
    return float(min(thr[np.argmax(tpr - fpr)], 1.0))
