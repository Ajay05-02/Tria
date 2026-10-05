import type { Target, Vessel } from "./types"
import { riskColor, riskScore } from "./heart.js"

export const TARGETS: Target[] = ["Cath", "LAD", "LCX", "RCA"]
export const VESSELS: Vessel[] = ["LAD", "LCX", "RCA"]

export const pct = (p: number) => `${Math.round(p * 100)}%`
// Risks are never shown as 0% or 100%: no model is that certain
export const pctRisk = (p: number) => (p >= 0.995 ? ">99%" : p < 0.005 ? "<1%" : pct(p))
export const signed = (p: number) => `${p >= 0 ? "+" : "−"}${Math.abs(p * 100).toFixed(1)}`

// Plain-words mode: everyday names for patients and non-cardiologists
const PLAIN: Record<Target, string> = { Cath: "Any artery", LAD: "Front artery", LCX: "Side artery", RCA: "Right artery" }
const TECH: Record<Target, string> = { Cath: "CAD", LAD: "LAD", LCX: "LCX", RCA: "RCA" }
export const nameOf = (t: Target, plain: boolean) => (plain ? PLAIN : TECH)[t]
export const labelNames = (plain: boolean) => (plain ? PLAIN : TECH)

// Same green → ochre → red ramp as the arteries on the heart, anchored at each model's cut-off
export const riskHex = (p: number, threshold: number) => `#${riskColor(riskScore(p, threshold)).getHexString()}`
export { riskScore }

export function describeLabels(labels: Record<Target, number>) {
  if (!labels.Cath) return "no CAD"
  const v = VESSELS.filter((x) => labels[x])
  return `CAD${v.length ? ` (${v.join(", ")})` : ""}`
}
