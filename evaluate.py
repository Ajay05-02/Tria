"""Honest performance estimates for the v2 pipeline (reproduces Colab "Model improvement (v2)").

Stratified 5-fold cross-validation repeated 10 times (seeds 0-9). Everything data-driven
(forest, Platt calibrator, threshold, vessel models) is fitted inside the training folds only.
Writes reports/evaluation_v2.json, which train.py copies into models/metadata.json.

Run:  python evaluate.py            (about 20-30 minutes)
      python evaluate.py --repeats 3  (quick check)
"""
import argparse
import json
import time

import numpy as np
import statsmodels.api as sm
from scipy import stats
from sklearn.metrics import brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from app.pipeline import (ROOT, VESSELS, add_clinical_features, apply_platt, fit_platt, load_raw, logit,
                          make_rf, model_features, pick_threshold, preprocess)


def _midrank(x):
    order = np.argsort(x)
    xs = x[order]
    ranks = np.zeros(len(x))
    i = 0
    while i < len(x):
        j = i
        while j < len(x) and xs[j] == xs[i]:
            j += 1
        ranks[i:j] = 0.5 * (i + j - 1) + 1
        i = j
    out = np.empty(len(x))
    out[order] = ranks
    return out


def delong_ci(y_true, scores, level=0.95):
    """AUC with a DeLong confidence interval (fast algorithm of Sun & Xu 2014)."""
    y_true, s = np.asarray(y_true), np.asarray(scores, dtype=float)
    pos, neg = s[y_true == 1], s[y_true == 0]
    m, n = len(pos), len(neg)
    tz = _midrank(np.concatenate([pos, neg]))
    auc = (tz[:m].sum() - m * (m + 1) / 2) / (m * n)
    v10 = (tz[:m] - _midrank(pos)) / n
    v01 = 1 - (tz[m:] - _midrank(neg)) / m
    se = np.sqrt(v10.var(ddof=1) / m + v01.var(ddof=1) / n)
    z = stats.norm.ppf(0.5 + level / 2)
    return auc, max(0.0, auc - z * se), min(1.0, auc + z * se)


def calibration_intercept_slope(y_true, p):
    lp = logit(p)
    slope = sm.GLM(y_true, sm.add_constant(lp), family=sm.families.Binomial()).fit().params[1]
    intercept = sm.GLM(y_true, np.ones_like(lp), family=sm.families.Binomial(), offset=lp).fit().params[0]
    return float(intercept), float(slope)


def summarise(y_true, prob_by_repeat, pred_by_repeat=None):
    rows = []
    for r in range(len(prob_by_repeat)):
        p = prob_by_repeat[r]
        auc, lo, hi = delong_ci(y_true, p)
        intercept, slope = calibration_intercept_slope(y_true, p)
        row = {"auc": auc, "auc_ci_low": lo, "auc_ci_high": hi, "brier": brier_score_loss(y_true, p),
               "calibration_intercept": intercept, "calibration_slope": slope}
        if pred_by_repeat is not None:
            tn, fp, fn, tp = confusion_matrix(y_true, pred_by_repeat[r]).ravel()
            row.update({"sensitivity": tp / (tp + fn), "specificity": tn / (tn + fp),
                        "ppv": tp / (tp + fp) if tp + fp else float("nan"),
                        "npv": tn / (tn + fn) if tn + fn else float("nan"),
                        "accuracy": (tp + tn) / len(y_true),
                        "f1": 2 * tp / (2 * tp + fp + fn)})
        rows.append(row)
    out = {k: float(np.mean([row[k] for row in rows])) for k in rows[0]}
    prev = float(np.mean(y_true))
    out["scaled_brier"] = 1 - out["brier"] / (prev * (1 - prev))
    out["auc_repeat_sd"] = float(np.std([row["auc"] for row in rows]))
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeats", type=int, default=10)
    args = parser.parse_args()
    R = args.repeats

    X, y = preprocess(load_raw())
    features = model_features(list(X.columns))
    Xall = add_clinical_features(X)
    Xf = Xall[features]
    n = len(Xf)
    y_cath = y["Cath"].values
    start = time.time()

    # Stage 1 check: original 55-feature forest (v1) vs v2 features, same splits, uncalibrated
    base = {t: np.zeros((R, n)) for t in y.columns}
    v2raw = {t: np.zeros((R, n)) for t in y.columns}
    # Stage 2: calibrated forest with nested threshold, for every target
    cal = {t: np.zeros((R, n)) for t in y.columns}
    pred = {t: np.zeros((R, n), dtype=int) for t in y.columns}
    thresholds = {t: [] for t in y.columns}
    # Two-step vessels
    joint = {v: np.zeros((R, n)) for v in VESSELS}

    for r in range(R):
        for t in y.columns:
            yt = y[t].values
            for tr, te in StratifiedKFold(n_splits=5, shuffle=True, random_state=r).split(Xf, yt):
                base[t][r, te] = make_rf().fit(X.iloc[tr], yt[tr]).predict_proba(X.iloc[te])[:, 1]
                inner = StratifiedKFold(n_splits=5, shuffle=True, random_state=100 + r)
                p_inner = cross_val_predict(make_rf(), Xf.iloc[tr], yt[tr], cv=inner, method="predict_proba")[:, 1]
                platt = fit_platt(p_inner, yt[tr])
                thr = pick_threshold(t, yt[tr], apply_platt(platt, p_inner))
                p_raw = make_rf().fit(Xf.iloc[tr], yt[tr]).predict_proba(Xf.iloc[te])[:, 1]
                v2raw[t][r, te] = p_raw
                cal[t][r, te] = apply_platt(platt, p_raw)
                pred[t][r, te] = (cal[t][r, te] >= thr).astype(int)
                thresholds[t].append(thr)

        # Two-step: reuse the Cath-stratified splits so P(CAD) is out-of-fold for each test patient
        for tr, te in StratifiedKFold(n_splits=5, shuffle=True, random_state=r).split(Xf, y_cath):
            cad_tr = tr[y_cath[tr] == 1]
            for v in VESSELS:
                yv = y[v].values[cad_tr]
                inner = StratifiedKFold(n_splits=5, shuffle=True, random_state=100 + r)
                p_inner = cross_val_predict(make_rf(), Xf.iloc[cad_tr], yv, cv=inner, method="predict_proba")[:, 1]
                platt = fit_platt(p_inner, yv)
                p_cond = apply_platt(platt, make_rf().fit(Xf.iloc[cad_tr], yv).predict_proba(Xf.iloc[te])[:, 1])
                joint[v][r, te] = cal["Cath"][r, te] * p_cond
        print(f"repeat {r + 1}/{R} done ({time.time() - start:.0f} s)", flush=True)

    result = {
        "protocol": f"Stratified 5-fold CV repeated {R} times (seeds 0-{R - 1}); forest, Platt calibrator, "
                    "threshold and vessel models fitted inside training folds only; DeLong 95% CIs averaged over repeats.",
        "v1_original_features_uncalibrated": {t: summarise(y[t].values, base[t]) for t in y.columns},
        "v2_features_uncalibrated": {t: summarise(y[t].values, v2raw[t]) for t in y.columns},
        "v2_calibrated_with_threshold": {t: {**summarise(y[t].values, cal[t], pred[t]),
                                             "mean_threshold": float(np.mean(thresholds[t]))} for t in y.columns},
        "v2_two_step_vessels (deployed)": {v: summarise(y[v].values, joint[v]) for v in VESSELS},
    }
    vessel_max = np.max([joint[v].mean(axis=0) for v in VESSELS], axis=0)
    result["coherence_two_step"] = float(np.mean(vessel_max > cal["Cath"].mean(axis=0) + 1e-9))
    independent_max = np.max([cal[v].mean(axis=0) for v in VESSELS], axis=0)
    result["coherence_independent"] = float(np.mean(independent_max > cal["Cath"].mean(axis=0)))

    out = ROOT / "reports" / "evaluation_v2.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    for t in y.columns:
        print(f"{t}: v1 AUC {result['v1_original_features_uncalibrated'][t]['auc']:.3f}  "
              f"v2 AUC {result['v2_calibrated_with_threshold'][t]['auc']:.3f}  "
              f"slope {result['v2_calibrated_with_threshold'][t]['calibration_slope']:.2f}")
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
