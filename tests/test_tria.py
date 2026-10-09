"""Checks that guard the claims Tria makes. Run: python -m pytest  (about 30 seconds)

Needs the trained models: run python train.py first (the Docker build does this automatically).
"""
import json
import math

import numpy as np
import pytest
from fastapi import HTTPException
from sklearn.metrics import roc_auc_score

from app.main import META, PATIENTS_X, PATIENTS_Y, PredictRequest, predict
from app.pipeline import ROOT, TARGETS, add_clinical_features, load_raw, model_features, preprocess

SAMPLE = range(0, 303, 7)   # 44 study patients spread across the dataset


def run(i, **changes):
    inputs = {k: float(v) for k, v in PATIENTS_X.loc[i].items()}
    inputs.update(changes)
    return predict(PredictRequest(inputs=inputs))


def test_no_target_leakage():
    X, y = preprocess(load_raw())
    features = model_features(list(X.columns))
    assert not set(TARGETS) & set(X.columns)
    assert not set(TARGETS) & set(features)
    assert list(y.columns) == list(TARGETS)


def test_engineered_features_are_finite():
    X, _ = preprocess(load_raw())
    Z = add_clinical_features(X)[model_features(list(X.columns))]
    assert np.isfinite(Z.to_numpy(dtype=float)).all()


@pytest.mark.parametrize("i", SAMPLE)
def test_artery_risk_never_exceeds_cad(i):
    out = run(i)
    for v in out["vessels"].values():
        assert v["probability"] <= out["cad"]["probability"] + 1e-12


@pytest.mark.parametrize("i", SAMPLE)
def test_explanations_add_up_to_the_risk_shown(i):
    out = run(i)
    shown = {"Cath": out["cad"]["probability"], **{v: d["probability"] for v, d in out["vessels"].items()}}
    for t, ex in out["explanations"].items():
        assert ex["probability"] == pytest.approx(shown[t], abs=1e-12)
        assert sum(c["points"] for c in ex["contributions"]) == pytest.approx(ex["probability"] - ex["base"], abs=1e-9)
        assert len({c["id"] for c in ex["contributions"]}) == len(ex["contributions"])   # each fact once


def test_chest_pain_appears_once():
    rows = [c["id"] for c in run(2)["explanations"]["Cath"]["contributions"]]
    assert "chest_pain" in rows
    assert not {"Typical Chest Pain", "Atypical", "Nonanginal"} & set(rows)


def test_typical_chest_pain_raises_risk():
    assert run(3, **{"Typical Chest Pain": 1.0})["cad"]["probability"] > run(3, **{"Typical Chest Pain": 0.0})["cad"]["probability"]


def test_out_of_range_input_is_flagged():
    assert any("outside the training data range" in w for w in run(0, Age=150.0)["warnings"])


def test_non_finite_input_is_rejected():
    with pytest.raises(HTTPException) as err:
        predict(PredictRequest(inputs={"Age": math.nan}))
    assert err.value.status_code == 422


@pytest.mark.parametrize("bad, why", [({"Age": -5.0}, "negative"), ({"DM": 2.0}, "0 (no) or 1 (yes)"), ({"DM": 0.5}, "0 (no) or 1 (yes)")])
def test_impossible_input_is_rejected(bad, why):
    with pytest.raises(HTTPException) as err:
        predict(PredictRequest(inputs=bad))
    assert err.value.status_code == 422 and why in err.value.detail


def test_reported_metrics_cover_the_brief():
    ev = META["evaluation"]
    deployed = {"Cath": ev["v2_calibrated_with_threshold"]["Cath"], **ev["v2_two_step_vessels (deployed)"]}
    for t in TARGETS:
        for metric in ["auc", "accuracy", "ppv", "sensitivity", "f1"]:   # ROC-AUC, accuracy, precision, recall, F1
            assert 0 <= deployed[t][metric] <= 1, (t, metric)


def test_heldout_predictions_match_reported_auc():
    heldout = json.loads((ROOT / "models" / "heldout_predictions.json").read_text())
    for t in TARGETS:
        auc = roc_auc_score(PATIENTS_Y[t], [r[t] for r in heldout])
        assert auc == pytest.approx(META["heldout_curves"]["targets"][t]["auc"], abs=1e-3)
    assert roc_auc_score(PATIENTS_Y["Cath"], [r["Cath"] for r in heldout]) > 0.9


def form_control_ids():
    """Ids of every row in Table 1: dropdown composites, chip groups and the remaining single inputs."""
    from app.features import CHIP_GROUPS, COMPOSITES, HIDDEN_INPUTS
    grouped = {f for g in COMPOSITES + CHIP_GROUPS for f in g["features"]}
    singles = {k for k in META["inputs"] if k not in grouped and k not in HIDDEN_INPUTS}
    return singles | {g["id"] for g in COMPOSITES + CHIP_GROUPS}


@pytest.mark.parametrize("i", SAMPLE)
def test_every_factor_opens_a_form_row(i):
    ids = form_control_ids()
    for ex in run(i)["explanations"].values():
        for c in ex["contributions"]:
            assert c["edit"] in ids or c["edit"] == "tab:Cath", c


def test_key_inputs_are_form_rows_and_cover_the_clinical_score():
    from app.features import KEY_INPUTS, input_columns
    assert set(KEY_INPUTS) <= form_control_ids()
    cadc_inputs = {"Age", "Sex", "Typical Chest Pain", "Atypical", "DM", "HTN", "DLP", "Current Smoker", "EX-Smoker"}
    assert cadc_inputs <= set(input_columns(KEY_INPUTS))


def test_key_inputs_give_nearly_full_accuracy():
    sets = META["input_sets"]
    assert sets["key"]["auc"] > sets["all"]["auc"] - 0.01
    assert sets["questions"]["auc"] < sets["key"]["auc"]
