# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Hackathon judges** (Multimodal AI Hackathon 2026, Track A) who see the app first in a 3-10 minute YouTube demo video and then open the public Hugging Face Space on a laptop, often in a dim room. They judge clarity, technical depth, the 3D visualisation and honesty.
- **Clinicians** (cardiologists, doctors) who may enter a real patient's values to see whether the risk and explanations make clinical sense.

## Product Purpose

Tria predicts overall coronary artery disease (CAD, ≥50% stenosis) and per-artery stenosis risk for the LAD, LCX and RCA from 55 routine clinical inputs. It maps each artery's risk onto an interactive 3D heart and explains every prediction with SHAP values and the CAD Consortium clinical score. Success means a viewer understands a patient's risk, which artery drives it and why within seconds, and trusts the numbers because the validation is shown honestly.

## Positioning

- The risk is painted onto the anatomy: each coronary artery is coloured by its own predicted risk, and clicking it highlights the heart muscle it supplies.
- Two-step vessel model: P(artery) = P(CAD) × P(artery | CAD), so an artery can never look riskier than CAD itself.
- Leakage-free validation (10× repeated nested 5-fold CV, DeLong CIs, pre-registered decisions), with the weaker artery-level AUCs reported plainly.

## Operating Context

- Single-page web app served by FastAPI (static HTML/CSS/vanilla JS modules, Three.js 0.160 from jsDelivr). Deployed as a Docker Hugging Face Space (port 7860).
- Workflow: pick an example patient or the median patient → edit any value → the prediction updates live (180 ms debounce) → inspect the heart, artery risks, SHAP factors and model accuracy.
- Recorded on screen for the demo video at 1080p.

## Capabilities and Constraints

- API: `/api/meta`, `/api/patients/{i}`, `/api/predict` (probabilities, thresholds, SHAP contributions, CADC points, range warnings).
- Inputs are grouped (Demographics, Symptoms, ECG, Echocardiography, labs, etc.) with composite selects (chest pain type, bundle branch block).
- 3D viewer: risk-map (territory) toggle, heartbeat at the patient's pulse, reset view, clickable artery labels.
- No build step and no framework; must keep working without a GPU.

## Brand Commitments

- Name: **Tria** (formerly flowstate and CardioVision 3D). It names the three main coronary arteries the app predicts: the LAD, LCX and RCA. Tagline: "three arteries, one clear picture".
- Voice: plain, specific, honest about limits. No hype.
- The educational-prototype disclaimer must stay visible: not a medical device, not a substitute for angiography. (The training-data limits live in Table 2 and the README.)

## Evidence on Hand

- Validation metrics in `reports/evaluation_v2.json` (CAD AUC 0.932, LAD 0.857, LCX 0.750, RCA 0.724; CAD sensitivity 0.91, specificity 0.81 at the rule-out cut-off).
- Dataset: Z-Alizadeh Sani extension (UCI #411, CC BY 4.0), 303 patients.
- No testimonials, users, clinical validation or regulatory claims exist; never invent them.

## Product Principles

1. The anatomy is the interface: risk is read on the heart first, numbers second.
2. Every number earns trust by showing where it came from (cut-off, SHAP, validation).
3. Honest about uncertainty: artery-level predictions are weaker and the UI says so.
4. Medical, not a toy: no gamified or sci-fi effects; also not a grey EHR.
5. Legible on a screen recording: sizes and contrast survive a 1080p video.

## Accessibility & Inclusion

Risk must never be carried by colour alone (green-to-red is ambiguous for colour-blind viewers); pair colour with numbers and labels. Keyboard access to every control, visible focus, and reduced-motion support for the heartbeat and camera moves.
