// The risk colour ramp, in one place, with no 3D library behind it: green below a model's cut-off, ochre at it,
// red above it. The page, the PDF and the 3D heart all take their colours from here (the 3D heart builds its
// colour from `riskHex`; the legend in index.css repeats the same stops).
const LOW = "#2f9a68", MID = "#e0a21a", HIGH = "#c8352b"

// Score 0..1 anchored so that each model's cut-off sits exactly at the ochre midpoint;
// the colour reaches full green 30 points below the cut-off and full red 30 points above it
const RAMP_SPAN = 0.3
export function riskScore(p: number, threshold: number) {
  return p < threshold
    ? 0.5 * Math.max(0, 1 - (threshold - p) / RAMP_SPAN)
    : 0.5 + 0.5 * Math.min(1, (p - threshold) / RAMP_SPAN)
}

// Colours are blended in linear light, as the 3D renderer does, so the page and the heart show the same hue
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
const rgb = (hex: string) => [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
const STOPS = { LOW: rgb(LOW), MID: rgb(MID), HIGH: rgb(HIGH) }
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

export function riskHexFromScore(score: number) {
  const c = score < 0.5
    ? mix(STOPS.LOW, STOPS.MID, (score / 0.5) ** 2)
    : mix(STOPS.MID, STOPS.HIGH, ((score - 0.5) / 0.5) ** 0.7)
  return "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("")
}
