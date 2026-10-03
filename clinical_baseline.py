"""Does flowstate beat the scores doctors already use? Compare, on the same 303 patients:

  ESC 2019 pre-test probability   (Knuuti et al., Eur Heart J 2020;41:407, Table 5: age band, sex, symptom type)
  CAD Consortium clinical model    (Genders et al., BMJ 2012;344:e3485: age, sex, chest pain, DM, HTN, DLP, smoking)
  flowstate                        held-out (cross-validated) CAD predictions from train.py

Metrics: ROC-AUC with paired bootstrap CIs of the difference; specificity at 90% sensitivity (how many unnecessary
angiograms each method would avoid while catching 90% of CAD patients, each method at its own best cut-off);
the ESC "test above 15%" rule against flowstate's rule-out cut-off, whose numbers come from evaluate.py (the cut-off is
chosen inside the training folds, so it is not tuned on the patients it is scored on); mean predicted risk;
decision curves with the two scores recalibrated to this population by 5-fold logistic recalibration (a fair
comparison: published scores were built for lower-risk patients).

Writes reports/clinical_baseline.json, which train.py copies into models/metadata.json for the app.
Run: python clinical_baseline.py  (needs models/heldout_predictions.json from train.py)
"""
import json

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from app.pipeline import ROOT, add_clinical_features, load_raw, preprocess

OUT = ROOT / "reports" / "clinical_baseline.json"
EVALUATION = ROOT / "reports" / "evaluation_v2.json"   # nested cross-validation, from evaluate.py
SENSITIVITY = 0.90   # the rule-out target flowstate is designed for

# ESC 2019 Table 5, percent. Rows: age bands 30-39 .. 70+. Columns per symptom: (men, women)
ESC_BANDS = [(30, 39), (40, 49), (50, 59), (60, 69), (70, 200)]
ESC_PTP = {
    "typical":     [(3, 5), (22, 10), (32, 13), (44, 16), (52, 27)],
    "atypical":    [(4, 3), (10, 6), (17, 6), (26, 11), (34, 19)],
    "non-anginal": [(1, 1), (3, 2), (11, 3), (22, 6), (24, 10)],
    "dyspnoea":    [(0, 3), (12, 3), (20, 9), (27, 14), (32, 12)],
}


def yes(series):
    return series.astype(str).str.strip().str.upper().isin(["Y", "1"]).values


def esc_ptp(raw):
    """ESC 2019 PTP for each patient. Under-30s use the 30-39 row; patients with neither chest pain nor
    dyspnoea (no ESC class) get the non-anginal value, the lowest class (reported as 'asymptomatic')."""
    typical, atypical, nonang = yes(raw["Typical Chest Pain"]), yes(raw["Atypical"]), yes(raw["Nonanginal"])
    dyspnoea = yes(raw["Dyspnea"])
    male = raw["Sex"].astype(str).str.strip().str.lower().eq("male").values
    out, classes = np.zeros(len(raw)), []
    for i, age in enumerate(raw["Age"].values):
        band = next(b for b, (lo, hi) in enumerate(ESC_BANDS) if age <= hi)
        if typical[i]:
            cls = "typical"
        elif atypical[i]:
            cls = "atypical"
        elif nonang[i]:
            cls = "non-anginal"
        elif dyspnoea[i]:
            cls = "dyspnoea"
        else:
            cls = "asymptomatic"
        table = ESC_PTP["non-anginal" if cls == "asymptomatic" else cls]
        out[i] = table[band][0 if male[i] else 1] / 100
        classes.append(cls)
    return out, classes


def boot_diff(y, a, b, rng, n=2000):
    """Paired bootstrap of AUC(a) - AUC(b): mean and 95% interval."""
    d = []
    for _ in range(n):
        i = rng.integers(0, len(y), len(y))
        if y[i].min() != y[i].max():
            d.append(roc_auc_score(y[i], a[i]) - roc_auc_score(y[i], b[i]))
    return [round(float(np.mean(d)), 3), round(float(np.percentile(d, 2.5)), 3), round(float(np.percentile(d, 97.5)), 3)]


def boot_auc(y, p, rng, n=2000):
    v = []
    for _ in range(n):
        i = rng.integers(0, len(y), len(y))
        if y[i].min() != y[i].max():
            v.append(roc_auc_score(y[i], p[i]))
    return [round(float(np.percentile(v, 2.5)), 3), round(float(np.percentile(v, 97.5)), 3)]


def spec_at_sens(y, p, target):
    """Highest specificity among cut-offs that still catch at least `target` of CAD patients."""
    best = 0.0
    for t in np.unique(p):
        pred = p >= t
        sens = pred[y == 1].mean()
        if sens >= target:
            best = max(best, (~pred[y == 0]).mean())
    return float(best)


def recalibrate(y, p):
    """5-fold logistic recalibration on the logit: the score's ranking is kept, its level fitted to this population."""
    z = np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4))).reshape(-1, 1)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
    return cross_val_predict(LogisticRegression(), z, y, cv=cv, method="predict_proba")[:, 1]


def net_benefit(y, p, t):
    pred = p >= t
    n = len(y)
    tp, fp = (pred & (y == 1)).sum(), (pred & (y == 0)).sum()
    return float(tp / n - fp / n * t / (1 - t))


def main():
    raw = load_raw()
    X, y_all = preprocess(raw)
    y = y_all["Cath"].values
    p_model = np.array([r["Cath"] for r in json.loads((ROOT / "models" / "heldout_predictions.json").read_text())])
    p_esc, esc_classes = esc_ptp(raw)
    p_cadc = 1 / (1 + np.exp(-add_clinical_features(X)["CADC_logit"].values))

    rng = np.random.default_rng(0)
    methods = {"ESC 2019 pre-test probability": p_esc, "CAD Consortium clinical score": p_cadc, "flowstate": p_model}

    rows = {}
    for name, p in methods.items():
        rows[name] = {
            "auc": round(float(roc_auc_score(y, p)), 3),
            "auc_ci95": boot_auc(y, p, rng),
            "mean_predicted": round(float(p.mean()), 3),
            "specificity_at_90_sensitivity": round(spec_at_sens(y, p, SENSITIVITY), 3),
        }
    for name in ["ESC 2019 pre-test probability", "CAD Consortium clinical score"]:
        rows[name]["flowstate_auc_minus_this"] = boot_diff(y, p_model, methods[name], rng)

    # The ESC rule as written: test when PTP > 15%
    esc_test = p_esc > 0.15
    esc_rule = {
        "referred_share": round(float(esc_test.mean()), 3),
        "sensitivity": round(float(esc_test[y == 1].mean()), 3),
        "specificity": round(float((~esc_test[y == 0]).mean()), 3),
        "missed_cad_patients": int((~esc_test & (y == 1)).sum()),
    }
    # flowstate's rule-out cut-off, from nested cross-validation: choosing the cut-off on these same held-out
    # predictions would flatter it (it gave 14 missed patients; the honest figure is about 20)
    nested = json.loads(EVALUATION.read_text())["v2_calibrated_with_threshold"]["Cath"]
    model_rule = {
        "source": "evaluate.py: 10x repeated nested 5-fold CV, cut-off chosen inside the training folds",
        "mean_cut_off": round(float(nested["mean_threshold"]), 3),
        "sensitivity": round(float(nested["sensitivity"]), 3),
        "specificity": round(float(nested["specificity"]), 3),
        "missed_cad_patients": round(float((1 - nested["sensitivity"]) * y.sum()), 1),
    }

    # Decision curves, with both scores recalibrated to this population
    thresholds = [round(t, 2) for t in np.arange(0.10, 0.86, 0.05)]
    recal = {"ESC 2019 (recalibrated)": recalibrate(y, p_esc), "CAD Consortium (recalibrated)": recalibrate(y, p_cadc),
             "flowstate": p_model}
    curves = {name: [round(net_benefit(y, p, t), 4) for t in thresholds] for name, p in recal.items()}
    curves["Refer everyone"] = [round(float(y.mean() - (1 - y.mean()) * t / (1 - t)), 4) for t in thresholds]

    report = {
        "n_patients": int(len(y)), "cad_rate": round(float(y.mean()), 3),
        "flowstate_predictions": "held-out (5-fold cross-validated) predictions from train.py",
        "esc_symptom_classes": {c: esc_classes.count(c) for c in sorted(set(esc_classes))},
        "methods": rows, "esc_rule_ptp_over_15": esc_rule, "flowstate_rule_out_cut_off": model_rule,
        "sensitivity_target": SENSITIVITY,
        "decision_curve": {"thresholds": thresholds, "net_benefit": curves},
        "notes": ["ESC classes: under-30s use the 30-39 row; patients with no chest pain and no dyspnoea get the "
                  "non-anginal (lowest) value.",
                  "The CAD Consortium score is also one of flowstate's inputs; flowstate adds ECG, echo and "
                  "laboratory information on top of it."],
    }
    OUT.write_text(json.dumps(report, indent=2))

    for name, r in rows.items():
        print(f"{name:32s} AUC {r['auc']:.3f} {r['auc_ci95']}  mean predicted {r['mean_predicted']:.2f}  "
              f"specificity at 90% sensitivity {r['specificity_at_90_sensitivity']:.2f}"
              + (f"  flowstate minus this {r['flowstate_auc_minus_this']}" if "flowstate_auc_minus_this" in r else ""))
    print("ESC rule (PTP > 15%):", esc_rule)
    print("flowstate rule-out cut-off:", model_rule)
    print("ESC symptom classes:", report["esc_symptom_classes"])
    i30, i50 = thresholds.index(0.3), thresholds.index(0.5)
    for name, c in curves.items():
        print(f"net benefit {name:32s} at 30%: {c[i30]:.3f}  at 50%: {c[i50]:.3f}")
    print(f"Saved {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
