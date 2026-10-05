// The 11 key questions, asked one per screen. Together they give almost the full accuracy of every input
// (train.py measures this: CAD ROC-AUC 0.930 vs 0.933). Each answer sets one or more model inputs.
import type { Inputs } from "./types"

export type Illustration =
  | "age" | "sex" | "chestPain" | "bloodSugar" | "bp" | "cholesterol" | "smoking" | "ecg" | "wallMotion" | "pump" | "bloodTest"

interface Base { id: string; title: string; desc: string; illus: Illustration }
export interface NumberQuestion extends Base { kind: "number"; key: string; unit: string }
export interface ChoiceQuestion extends Base { kind: "choice"; options: { label: string; desc?: string; values: Inputs }[] }
export interface MultiQuestion extends Base { kind: "multi"; options: { key: string; label: string; desc?: string }[] }
export type Question = NumberQuestion | ChoiceQuestion | MultiQuestion

const yesNo = (key: string) => [
  { label: "No", values: { [key]: 0 } },
  { label: "Yes", values: { [key]: 1 } },
]

// `id` matches the form ids the explanations use for "click to edit" (app/features.py)
export const QUESTIONS: Question[] = [
  { id: "Age", kind: "number", key: "Age", unit: "Years", illus: "age",
    title: "How old is the patient?", desc: "After symptoms, age is the strongest single driver of coronary risk." },
  { id: "Sex", kind: "choice", illus: "sex",
    title: "Biological sex", desc: "Men tend to develop coronary artery disease earlier than women.",
    options: [{ label: "Female", values: { Sex: 0 } }, { label: "Male", values: { Sex: 1 } }] },
  { id: "chest_pain", kind: "choice", illus: "chestPain",
    title: "What kind of chest pain?", desc: "Chest pain type is the strongest signal in the whole model.",
    options: [
      { label: "None", desc: "No chest pain", values: { "Typical Chest Pain": 0, Atypical: 0, Nonanginal: 0 } },
      { label: "Typical angina", desc: "Pressure in the chest that comes with effort and eases with rest", values: { "Typical Chest Pain": 1, Atypical: 0, Nonanginal: 0 } },
      { label: "Atypical angina", desc: "Some, but not all, features of typical angina", values: { "Typical Chest Pain": 0, Atypical: 1, Nonanginal: 0 } },
      { label: "Non-anginal pain", desc: "Chest pain that is unlikely to come from the heart", values: { "Typical Chest Pain": 0, Atypical: 0, Nonanginal: 1 } },
    ] },
  { id: "DM", kind: "choice", illus: "bloodSugar", options: yesNo("DM"),
    title: "Diabetes?", desc: "Diagnosed diabetes, or taking medicine for it." },
  { id: "HTN", kind: "choice", illus: "bp", options: yesNo("HTN"),
    title: "High blood pressure?", desc: "Diagnosed hypertension, or taking medicine for it." },
  { id: "DLP", kind: "choice", illus: "cholesterol", options: yesNo("DLP"),
    title: "High cholesterol?", desc: "Diagnosed dyslipidaemia: high LDL or triglycerides, or low HDL." },
  { id: "smoking", kind: "choice", illus: "smoking",
    title: "Smoking", desc: "Smoking damages the lining of the heart's arteries.",
    options: [
      { label: "Never smoked", values: { "Current Smoker": 0, "EX-Smoker": 0 } },
      { label: "Ex-smoker", values: { "Current Smoker": 0, "EX-Smoker": 1 } },
      { label: "Current smoker", values: { "Current Smoker": 1, "EX-Smoker": 0 } },
    ] },
  { id: "ecg_signs", kind: "multi", illus: "ecg",
    title: "Resting ECG findings", desc: "Signs of reduced blood flow on a resting ECG. Select all that apply.",
    options: [
      { key: "Q Wave", label: "Pathological Q wave", desc: "Often a sign of an earlier heart attack" },
      { key: "St Elevation", label: "ST elevation" },
      { key: "St Depression", label: "ST depression" },
      { key: "Tinversion", label: "T-wave inversion" },
      { key: "Poor R Progression", label: "Poor R-wave progression" },
    ] },
  { id: "Region RWMA", kind: "choice", illus: "wallMotion",
    title: "Wall-motion abnormality", desc: "On an echocardiogram (heart ultrasound): how many regions of the heart wall move abnormally?",
    options: [
      { label: "None", values: { "Region RWMA": 0 } },
      { label: "1 region", values: { "Region RWMA": 1 } },
      { label: "2 regions", values: { "Region RWMA": 2 } },
      { label: "3 regions", values: { "Region RWMA": 3 } },
      { label: "4 regions", values: { "Region RWMA": 4 } },
    ] },
  { id: "EF-TTE", kind: "number", key: "EF-TTE", unit: "% ejection fraction", illus: "pump",
    title: "How strongly does the heart pump?", desc: "Ejection fraction from an echocardiogram. Normal is about 55 to 70%." },
  { id: "FBS", kind: "number", key: "FBS", unit: "mg/dL", illus: "bloodTest",
    title: "Fasting blood sugar", desc: "Blood glucose after an overnight fast. Normal is below 100 mg/dL." },
]

// Which question shows an answer as chosen: one whose inputs all match the current values
export const chosenOption = (q: ChoiceQuestion, inputs: Inputs) =>
  q.options.findIndex((o) => Object.entries(o.values).every(([k, v]) => inputs[k] === v))
