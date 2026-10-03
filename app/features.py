"""Human-readable labels, units and form layout for the 55 model inputs."""

GROUPS = [
    "Demographics",
    "Symptoms",
    "ECG",
    "Echocardiography",
    "Risk factors & history",
    "Vital signs & examination",
    "Laboratory",
]

# label, unit, group, and for numbers a step size; "options" turns the input into a dropdown
FEATURES = {
    "Age": {"label": "Age", "unit": "years", "group": "Demographics", "step": 1},
    "Sex": {"label": "Sex", "group": "Demographics", "options": {"0": "Female", "1": "Male"}},
    "Weight": {"label": "Weight", "unit": "kg", "group": "Demographics", "step": 1},
    "Length": {"label": "Height", "unit": "cm", "group": "Demographics", "step": 1},
    "BMI": {"label": "BMI", "unit": "kg/m²", "group": "Demographics", "step": 0.1},

    "Typical Chest Pain": {"label": "Typical chest pain", "group": "Symptoms"},
    "Atypical": {"label": "Atypical chest pain", "group": "Symptoms"},
    "Nonanginal": {"label": "Non-anginal chest pain", "group": "Symptoms"},
    "Dyspnea": {"label": "Shortness of breath", "group": "Symptoms"},
    "Function Class": {"label": "Functional class", "group": "Symptoms",
                       "options": {"0": "0", "1": "I", "2": "II", "3": "III"}},
    "LowTH Ang": {"label": "Low-threshold angina", "group": "Symptoms"},

    "Q Wave": {"label": "Pathological Q wave", "group": "ECG"},
    "St Elevation": {"label": "ST elevation", "group": "ECG"},
    "St Depression": {"label": "ST depression", "group": "ECG"},
    "Tinversion": {"label": "T-wave inversion", "group": "ECG"},
    "LVH": {"label": "Left ventricular hypertrophy", "group": "ECG"},
    "Poor R Progression": {"label": "Poor R-wave progression", "group": "ECG"},
    "BBB_LBBB": {"label": "Left bundle branch block", "group": "ECG"},
    "BBB_RBBB": {"label": "Right bundle branch block", "group": "ECG"},

    "EF-TTE": {"label": "Ejection fraction", "unit": "%", "group": "Echocardiography", "step": 5},
    "Region RWMA": {"label": "Regions with wall-motion abnormality", "group": "Echocardiography",
                    "options": {"0": "0", "1": "1", "2": "2", "3": "3", "4": "4"}},
    "VHD": {"label": "Valvular heart disease", "group": "Echocardiography",
            "options": {"0": "None", "1": "Mild", "2": "Moderate", "3": "Severe"}},

    "DM": {"label": "Diabetes", "group": "Risk factors & history"},
    "HTN": {"label": "Hypertension", "group": "Risk factors & history"},
    "DLP": {"label": "Dyslipidemia", "group": "Risk factors & history"},
    "Current Smoker": {"label": "Current smoker", "group": "Risk factors & history"},
    "EX-Smoker": {"label": "Ex-smoker", "group": "Risk factors & history"},
    "FH": {"label": "Family history of heart disease", "group": "Risk factors & history"},
    "Obesity": {"label": "Obesity", "group": "Risk factors & history"},
    "CRF": {"label": "Chronic renal failure", "group": "Risk factors & history"},
    "CVA": {"label": "Previous stroke", "group": "Risk factors & history"},
    "Airway disease": {"label": "Airway disease", "group": "Risk factors & history"},
    "Thyroid Disease": {"label": "Thyroid disease", "group": "Risk factors & history"},
    "CHF": {"label": "Congestive heart failure", "group": "Risk factors & history"},

    "BP": {"label": "Blood pressure", "unit": "mmHg", "group": "Vital signs & examination", "step": 5},
    "PR": {"label": "Pulse rate", "unit": "bpm", "group": "Vital signs & examination", "step": 1},
    "Edema": {"label": "Edema", "group": "Vital signs & examination"},
    "Weak Peripheral Pulse": {"label": "Weak peripheral pulse", "group": "Vital signs & examination"},
    "Lung rales": {"label": "Lung rales", "group": "Vital signs & examination"},
    "Systolic Murmur": {"label": "Systolic murmur", "group": "Vital signs & examination"},
    "Diastolic Murmur": {"label": "Diastolic murmur", "group": "Vital signs & examination"},

    "FBS": {"label": "Fasting blood sugar", "unit": "mg/dL", "group": "Laboratory", "step": 1},
    "CR": {"label": "Creatinine", "unit": "mg/dL", "group": "Laboratory", "step": 0.1},
    "TG": {"label": "Triglycerides", "unit": "mg/dL", "group": "Laboratory", "step": 1},
    "LDL": {"label": "LDL cholesterol", "unit": "mg/dL", "group": "Laboratory", "step": 1},
    "HDL": {"label": "HDL cholesterol", "unit": "mg/dL", "group": "Laboratory", "step": 1},
    "BUN": {"label": "Blood urea nitrogen", "unit": "mg/dL", "group": "Laboratory", "step": 1},
    "ESR": {"label": "ESR", "unit": "mm/h", "group": "Laboratory", "step": 1},
    "HB": {"label": "Haemoglobin", "unit": "g/dL", "group": "Laboratory", "step": 0.1},
    "K": {"label": "Potassium", "unit": "mEq/L", "group": "Laboratory", "step": 0.1},
    "Na": {"label": "Sodium", "unit": "mEq/L", "group": "Laboratory", "step": 1},
    "WBC": {"label": "White blood cells", "unit": "/mm³", "group": "Laboratory", "step": 100},
    "Lymph": {"label": "Lymphocytes", "unit": "%", "group": "Laboratory", "step": 1},
    "Neut": {"label": "Neutrophils", "unit": "%", "group": "Laboratory", "step": 1},
    "PLT": {"label": "Platelets", "unit": "×1000/mm³", "group": "Laboratory", "step": 1},
}

# Groups of one-hot columns shown as a single dropdown; each option sets all listed features
COMPOSITES = [
    {
        "id": "chest_pain", "label": "Chest pain type", "group": "Symptoms",
        "features": ["Typical Chest Pain", "Atypical", "Nonanginal"],
        "options": [
            {"label": "None", "values": [0, 0, 0]},
            {"label": "Typical angina", "values": [1, 0, 0]},
            {"label": "Atypical", "values": [0, 1, 0]},
            {"label": "Non-anginal", "values": [0, 0, 1]},
        ],
    },
    {
        "id": "bbb", "label": "Bundle branch block", "group": "ECG",
        "features": ["BBB_LBBB", "BBB_RBBB"],
        "options": [
            {"label": "None", "values": [0, 0]},
            {"label": "Left (LBBB)", "values": [1, 0]},
            {"label": "Right (RBBB)", "values": [0, 1]},
        ],
    },
]

# Inputs the v2 model does not use and the form hides: too rare to learn from, or derived from BMI
HIDDEN_INPUTS = ["CHF", "LowTH Ang", "Weak Peripheral Pulse", "CVA", "Obesity"]

# Engineered features computed by the server from the form inputs (app/pipeline.py)
ENGINEERED_LABELS = {
    "CADC_logit": "CAD Consortium score",
    "ECG_isch_count": "Ischaemic ECG signs",
    "EF_lt50": "EF below 50%",
    "RWMA_any": "Wall-motion abnormality",
    "LV_damage": "LV damage index",
    "NLR": "Neutrophil/lymphocyte ratio",
    "eGFR": "eGFR",
}

# Panel C shows one row per clinical fact. Model features that encode the same fact are summed into one row
# (SHAP values add up, so this is exact); "edit" is the form input (or composite dropdown) a click opens.
EXPLAIN_GROUPS = [
    {"id": "chest_pain", "label": "Chest pain type", "edit": "chest_pain",
     "features": ["Typical Chest Pain", "Atypical", "Nonanginal"]},
    {"id": "smoking", "label": "Smoking", "edit": "Current Smoker", "features": ["Current Smoker", "EX-Smoker"]},
    {"id": "ecg", "label": "Ischaemic ECG signs", "edit": "St Depression",
     "features": ["ECG_isch_count", "Q Wave", "St Elevation", "St Depression", "Tinversion", "Poor R Progression"]},
    {"id": "ef", "label": "Ejection fraction", "edit": "EF-TTE", "features": ["EF-TTE", "EF_lt50"]},
    {"id": "rwma", "label": "Wall-motion abnormality", "edit": "Region RWMA",
     "features": ["Region RWMA", "RWMA_any", "LV_damage"]},
    {"id": "kidney", "label": "Kidney function", "edit": "CR", "features": ["CR", "eGFR"]},
    {"id": "nlr", "label": "Neutrophil/lymphocyte ratio", "edit": "Neut", "features": ["NLR", "Neut", "Lymph"]},
    {"id": "bbb", "label": "Bundle branch block", "edit": "bbb", "features": ["BBB_LBBB", "BBB_RBBB"]},
]

VESSELS = {
    "Cath": {"name": "Overall CAD", "full": "Coronary artery disease (any vessel ≥50% narrowed)",
             "territory": "Whole heart"},
    "LAD": {"name": "LAD", "full": "Left anterior descending artery",
            "territory": "Front wall of the left ventricle, front of the septum and the apex"},
    "LCX": {"name": "LCX", "full": "Left circumflex artery",
            "territory": "Side (lateral) and back wall of the left ventricle"},
    "RCA": {"name": "RCA", "full": "Right coronary artery",
            "territory": "Right ventricle and the bottom (inferior) wall of the heart"},
}
