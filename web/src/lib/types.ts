// Shapes of the FastAPI responses (app/main.py)

export type Target = "Cath" | "LAD" | "LCX" | "RCA"
export type Vessel = "LAD" | "LCX" | "RCA"

export interface Field {
  key: string
  label: string
  unit: string
  hint: string
  group: string
  kind: "number" | "binary" | "select"
  options: Record<string, string> | null
  step: number
  min: number
  max: number
  median: number
}

export interface ChoiceGroup {
  id: string
  label: string
  hint?: string
  group: string
  features: string[]
  options?: { label: string; values: number[] }[]   // dropdown composites (chest pain, smoking, BBB)
  labels?: string[]                                  // chip groups (ECG signs)
}

export interface Metrics {
  auc: number
  auc_ci_low: number
  auc_ci_high: number
  brier: number
  calibration_slope: number
  accuracy: number
  ppv: number
  sensitivity: number
  specificity: number
  npv: number
  f1: number
}

export interface Meta {
  n_patients: number
  groups: string[]
  fields: Field[]
  composites: ChoiceGroup[]
  chip_groups: ChoiceGroup[]
  key_inputs: string[]
  input_sets: { questions: { items: number; auc: number }; key: { items: number; auc: number }; all: { auc: number } } | null
  vessels: Record<Target, { name: string; full: string; territory: string }>
  thresholds: Record<Target, number>
  evaluation: {
    protocol: string
    v2_calibrated_with_threshold: { Cath: Metrics }
    "v2_two_step_vessels (deployed)": Record<Vessel, Metrics>
  } | null
  external_validation: {
    n_patients: number
    chosen_model: string
    loco_auc: Record<string, { Mean: number }>
    hospitals: Record<string, { cad_rate: number }>
    calibration: { hospital: string; n: number; auc: number; ci95: [number, number] }[]
  } | null
  clinical_baseline: {
    n_patients: number
    sensitivity_target: number
    methods: Record<string, { auc: number; auc_ci95: [number, number]; specificity_at_90_sensitivity: number; tria_auc_minus_this?: [number, number, number] }>
    esc_rule_ptp_over_15: { missed_cad_patients: number; sensitivity: number; specificity: number }
    tria_rule_out_cut_off: { missed_cad_patients: number; sensitivity: number; specificity: number }
  } | null
  localisation_auc: Record<Vessel, number> | null
  cad_vessel_rate: Record<Vessel, number> | null
  heldout_curves: { targets: Record<Target, { auc: number; roc: [number, number][]; calibration: [number, number, number][] }> } | null
  patients: { index: number; age: number; sex: number; labels: Record<Target, number> }[]
}

export interface Contribution {
  id: string
  label: string
  text: string
  edit: string
  points: number
}

export interface Prediction {
  cad: { probability: number; threshold: number; high: boolean }
  vessels: Record<Vessel, { probability: number; conditional: number; threshold: number; high: boolean }>
  explanations: Record<Target, { base: number; probability: number; contributions: Contribution[] }>
  warnings: string[]
}

export interface Example {
  index: number
  labels: Record<Target, number>
  heldout: Record<Target, number> | null
}

export type Inputs = Record<string, number>

// An artery as the results show it: overall risk against its cut-off, or P(artery | CAD) against the average CAD patient
export type ArteryView = { probability: number; threshold: number; high: boolean }
