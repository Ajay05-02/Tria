---
title: CardioVision 3D
emoji: 🫀
colorFrom: red
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: Coronary artery disease risk mapped onto an interactive 3D heart
---

# CardioVision 3D

**Predicts coronary artery disease (CAD) and the stenosis risk of each main coronary artery (LAD, LCX, RCA) from routine clinical data, then maps the risk onto an interactive 3D heart.**

Built for the **Multimodal AI Hackathon 2026, Track A: Cardiovascular Risk Visualization & Prediction**.

> ⚠ **Educational decision-support prototype only.** Not a medical device and not a substitute for coronary angiography or formal diagnostic imaging.

![CardioVision 3D dashboard](docs/screenshot.jpg)

## What it does

- **Predicts** overall CAD (≥50% narrowing in any coronary artery) and stenosis of the **LAD**, **LCX** and **RCA** from 55 demographic, symptom, ECG, echocardiography and laboratory inputs.
- **Visualises** the result on a 3D heart (Three.js, runs in any modern browser without a GPU):
  - each artery is coloured green → yellow → red by its predicted risk, with yellow anchored at the model's decision cut-off;
  - click an artery, or its floating label, and the camera turns to it and highlights the heart muscle it supplies;
  - the **Risk map** toggle colours every territory by its artery's risk;
  - there is an optional translucent torso and ribs for context, and the heart beats at the patient's pulse rate.
- **Explains** every prediction with **SHAP** values: which measurements pushed the risk up or down, and by how much. It also shows the "points" behind the published CAD Consortium risk score.
- **Updates in real time** as you edit any value, and warns when an input is outside the range seen in training.

## Results (honest, leakage-free validation)

Stratified 5-fold cross-validation repeated 10 times. Every data-driven step is fitted **inside the training folds only**: the forest, the Platt calibrator, the decision threshold and the vessel models. 95% CIs are DeLong intervals averaged over the repeats.

| Target | ROC-AUC (95% CI) | Brier | Calibration slope |
|---|---|---|---|
| Overall CAD | **0.932** (0.900–0.964) | 0.086 | 0.95 |
| LAD | **0.857** (0.814–0.901) | 0.143 | 1.15 |
| LCX | **0.750** (0.696–0.804) | 0.195 | 0.94 |
| RCA | **0.724** (0.668–0.780) | 0.198 | 1.00 |

- **Overall CAD at the pre-specified rule-out cut-off:** sensitivity 0.91, specificity 0.81, PPV 0.92, NPV 0.78.
- **Improvement over our first model:** evaluated on the same splits, AUC rose on all four targets (+0.012 to +0.021). Calibration slopes also improved, from 1.3–2.2 (probabilities too timid) to about 1.0.
- **Why the arteries score lower:** the dataset records ECG and wall-motion findings only as present/absent. It never says *which* leads or heart regions are affected, and that location information is what clinicians use to tell LCX from RCA disease.

All numbers come from `python evaluate.py`, which saves them to `reports/evaluation_v2.json`.

## How the model works

```
55 clinical inputs
  → label-free cleaning (drop 4 near-empty columns and 2 exact duplicates: Weight, Obesity)
  → + 7 features from fixed published formulas (no fitting, so no leakage):
      CAD Consortium clinical score (Genders et al., BMJ 2012), CKD-EPI 2021 eGFR,
      neutrophil-to-lymphocyte ratio, ischaemic ECG count, EF < 50%, any wall-motion abnormality,
      LV damage index = max(0, 60 − EF) × abnormal regions
  → P(CAD)    = Platt-calibrated random forest
  → P(vessel) = P(CAD) × Platt-calibrated random forest trained on CAD patients only
```

- **Two-step vessel model.** A blocked artery *means* CAD, so an artery must never look riskier than CAD itself. With independent models, that happened for 19.8% of patients; the two-step design removes it (0%) at a cost of 0.006 mean vessel AUC.
- **Pre-registered decisions.** Candidate models, the selection rule, the threshold rules and the data-cleaning rules were written down before any experiment (`notebooks/`, `preregistration.json` in the Colab run).
- **Label noise.** One patient is labelled LAD-stenotic but CAD-negative. We keep the label as recorded; relabelling or excluding the patient changes the CAD AUC by less than 0.01.

## Run it locally

Prerequisites: Python 3.11+ (tested on 3.13).

```bash
pip install -r requirements.txt
python train.py                       # about 20 s: builds models/ and data/processed/
python -m uvicorn app.main:app --port 8000
```

Then open http://localhost:8000.

To reproduce the validation numbers (about 10–30 minutes):

```bash
python evaluate.py
python train.py        # copies reports/evaluation_v2.json into models/metadata.json
```

With Docker, which is also how the Hugging Face Space runs:

```bash
docker build -t cardiovision .
docker run -p 7860:7860 cardiovision
```

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/meta` | Form layout, thresholds, validation metrics |
| GET | `/api/patients/{index}` | Inputs and true labels of a dataset patient (for demos) |
| POST | `/api/predict` | `{"inputs": {...}}` → probabilities, SHAP explanations, CAD Consortium breakdown, warnings |

## Project structure

```
app/pipeline.py    shared preprocessing + engineered features (used by training AND the server)
app/features.py    labels, units and form layout for the inputs
app/main.py        FastAPI server and prediction API
train.py           trains and saves the final models (models/)
evaluate.py        repeated nested cross-validation → reports/evaluation_v2.json
static/            web app: index.html, css/, js/heart.js (3D scene), js/app.js (dashboard)
data/raw/          the original dataset zip (UCI #411)
```

## Data and credits

- **Dataset:** Extension of Z-Alizadeh Sani dataset, UCI Machine Learning Repository #411 (CC BY 4.0). It covers 303 patients who underwent coronary angiography at Shaheed Rajaei Cardiovascular Center, Tehran. Alizadehsani et al.
- **CAD Consortium clinical model:** Genders T.S.S. et al., *BMJ* 2012;344:e3485.
- **eGFR:** CKD-EPI 2021 creatinine equation, Inker L.A. et al., *NEJM* 2021.
- **Libraries:** scikit-learn, SHAP, FastAPI, Three.js.

## Limitations

- **Small, single-centre data:** 303 patients from one centre, all referred for angiography (71% had CAD). Predictions apply to similar high-risk patients, not to screening the general population.
- **No external validation:** no public dataset has the same inputs and per-artery labels.
- **Vessel predictions reflect how extensive the disease is,** not its exact location: the inputs contain no ECG-lead or wall-segment information.
- **The 3D heart is procedurally generated.** It is an illustrative anatomical model, not patient-specific imaging.

## AI assistance

This project was developed with the help of an AI coding assistant (Claude by Anthropic), used for research, code generation and review. All modelling decisions were pre-registered and validated as described above.
