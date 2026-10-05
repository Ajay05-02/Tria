// One-page A4 patient report, built in the browser with jsPDF
import type { HeartViewer } from "./heart.js"
import { describeLabels, nameOf, pct, pctRisk, riskHex, signed, TARGETS } from "./format"
import type { Example, Inputs, Meta, Prediction } from "./types"

type RGB = [number, number, number]
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
const pdfText = (s: string) => s.replace(/−/g, "-").replace(/≥/g, ">=")   // keep to the standard PDF fonts

// One image of the heart with its artery labels drawn in, cropped to the heart, on white
async function heartImage(viewer: HeartViewer, stage: HTMLElement) {
  const shot = new Image()
  shot.src = viewer.snapshot(2.5)
  await shot.decode()
  const box = stage.getBoundingClientRect()
  const k = shot.naturalWidth / box.width
  const canvas = Object.assign(document.createElement("canvas"), { width: shot.naturalWidth, height: shot.naturalHeight })
  const g = canvas.getContext("2d")!
  g.fillStyle = "#ffffff"
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(shot, 0, 0)
  g.textBaseline = "middle"
  for (const label of stage.querySelectorAll<HTMLElement>(".vessel-label")) {
    const r = label.getBoundingClientRect()
    if (!r.width) continue
    const x = (r.left - box.left) * k, y = (r.top - box.top) * k, w = r.width * k, h = r.height * k
    g.fillStyle = "#ffffff"; g.strokeStyle = "#d4d4d8"; g.lineWidth = k
    g.beginPath(); g.roundRect(x, y, w, h, 6 * k); g.fill(); g.stroke()
    const sw = label.querySelector<HTMLElement>(".sw")!
    g.fillStyle = sw.style.background || "#d4d4d8"
    g.beginPath(); g.arc(x + 12 * k, y + h / 2, 4 * k, 0, Math.PI * 2); g.fill()
    g.fillStyle = "#18181b"
    g.font = `600 ${12 * k}px Geist, sans-serif`
    const name = label.querySelector(".nm")!.textContent ?? ""
    g.fillText(name, x + 22 * k, y + h / 2)
    g.fillStyle = "#52525b"
    g.font = `400 ${12 * k}px Geist, sans-serif`
    g.fillText(label.querySelector(".pct")!.textContent ?? "", x + 22 * k + g.measureText(name).width + 6 * k, y + h / 2)
  }
  // crop to everything that is not plain white, with a small margin
  const { data, width, height } = g.getImageData(0, 0, canvas.width, canvas.height)
  let x0 = width, y0 = height, x1 = 0, y1 = 0
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return { url: canvas.toDataURL("image/jpeg", 0.92), w: canvas.width, h: canvas.height }
  const pad = Math.round(0.04 * Math.max(x1 - x0, y1 - y0))
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width, x1 + pad); y1 = Math.min(height, y1 + pad)
  const crop = Object.assign(document.createElement("canvas"), { width: x1 - x0, height: y1 - y0 })
  crop.getContext("2d")!.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0)
  return { url: crop.toDataURL("image/jpeg", 0.92), w: crop.width, h: crop.height }
}

export interface ReportInput {
  viewer: HeartViewer
  stage: HTMLElement
  meta: Meta
  prediction: Prediction
  inputs: Inputs
  patientLabel: string
  example: Example | null
  edited: boolean
  mode: "risk" | "cond"
  plain: boolean
}

export async function savePdf({ viewer, stage, meta, prediction: p, inputs, patientLabel, example, edited, mode, plain }: ReportInput) {
  const [{ jsPDF }, heart] = await Promise.all([import("jspdf"), heartImage(viewer, stage)])
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const ink: RGB = [24, 24, 27], ink2: RGB = [82, 82, 91], ink3: RGB = [113, 113, 122], rule: RGB = [228, 228, 231]
  const W = 297, M = 14
  const heldout = example?.heldout && !edited ? example.heldout : null

  // header
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ink).text("flowstate", M, 17)
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink2).text("Coronary artery disease risk report", M + 33, 17)
  doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), W - M, 17, { align: "right" })
  doc.setDrawColor(...rule).setLineWidth(0.4).line(M, 20, W - M, 20)
  doc.setFillColor(254, 243, 199).roundedRect(M, 22.5, W - 2 * M, 7, 1.5, 1.5, "F")
  doc.setFontSize(8.5).setTextColor(146, 64, 14).text("Educational prototype. Not a medical device or a substitute for coronary angiography.", M + 3, 27)

  // patient
  const sex = inputs.Sex === 1 ? "man" : "woman"
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ink).text(`${patientLabel}, ${Math.round(inputs.Age)}-year-old ${sex}`, M, 38)
  if (example) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ink2)
      .text(`Angiography result: ${describeLabels(example.labels)}.${edited ? " Values edited since loading." : ""}`, M, 43)
  }

  // heart (left)
  const boxW = 150, boxH = 128
  const scale = Math.min(boxW / heart.w, boxH / heart.h)
  const iw = heart.w * scale, ih = heart.h * scale
  doc.addImage(heart.url, "JPEG", M + (boxW - iw) / 2, 48, iw, ih)
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink2).text(mode === "cond"
    ? "Arteries coloured by how likely each is the narrowed one if CAD is present, against the average CAD patient."
    : "Arteries coloured by predicted risk: green below the model's cut-off, ochre near it, red above it.",
    M, 48 + ih + 6, { maxWidth: boxW })

  // results (right)
  const X = 176, cad = p.cad
  doc.setFontSize(10).setTextColor(...ink2).text(plain ? "Chance of narrowed heart arteries" : "Coronary artery disease", X, 40)
  doc.setFont("helvetica", "bold").setFontSize(34).setTextColor(...ink).text(pdfText(pctRisk(cad.probability)), X, 55)
  doc.setFontSize(10).setTextColor(...((cad.high ? [185, 28, 28] : [4, 120, 87]) as RGB)).text(cad.high ? "Above cut-off" : "Below cut-off", X + 38, 47)
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink2)
    .text(`Cut-off ${pct(cad.threshold)}, set to catch 90% of CAD patients.`, X + 38, 53, { maxWidth: W - M - X - 38 })

  let y = 66
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text("Chance of 50% or more narrowing", X, y)
  y += 6
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink3)
  doc.text("Target", X, y); doc.text("Risk", X + 56, y, { align: "right" }); doc.text("Cut-off", X + 76, y, { align: "right" })
  doc.text("Status", X + 82, y)
  if (heldout) doc.text("Held-out", W - M, y, { align: "right" })
  y += 1.8
  doc.setDrawColor(...rule).setLineWidth(0.3).line(X, y, W - M, y)
  for (const t of TARGETS) {
    const d = t === "Cath" ? p.cad : p.vessels[t]
    y += 6.2
    doc.setFillColor(...rgb(riskHex(d.probability, d.threshold))).circle(X + 1.5, y - 1.3, 1.4, "F")
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ink).text(nameOf(t, plain), X + 5, y)
    doc.setFont("helvetica", t === "Cath" ? "bold" : "normal").text(pdfText(pctRisk(d.probability)), X + 56, y, { align: "right" })
    doc.setFont("helvetica", "normal").setTextColor(...ink2).text(pct(d.threshold), X + 76, y, { align: "right" })
    doc.text(d.high ? "above" : "below", X + 82, y)
    if (heldout) doc.text(pdfText(pctRisk(heldout[t])), W - M, y, { align: "right" })
  }
  y += 2.5
  doc.line(X, y, W - M, y)
  if (heldout) {
    y += 4.5
    doc.setFontSize(7.5).setTextColor(...ink3).text("Held-out: prediction from a model that never saw this patient.", X, y)
  }

  // reasons (CAD)
  y += 9
  const ex = p.explanations.Cath
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text("Why this result (overall CAD)", X, y)
  y += 4.5
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ink2).text(
    pdfText(`Typical patient ${pctRisk(ex.base)}, this patient ${pctRisk(ex.probability)}. Each bar is a factor's share of the difference, in percentage points.`),
    X, y, { maxWidth: W - M - X })
  y += 5
  const maxAbs = Math.max(...ex.contributions.map((c) => Math.abs(c.points)), 1e-6)
  const barX = X + 66, half = 13
  for (const c of ex.contributions.slice(0, 8)) {
    y += 7
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink).text(pdfText(c.label), X, y - 0.8, { maxWidth: 64 })
    doc.setTextColor(...ink3).setFontSize(7).text(pdfText(c.text), X, y + 2.3, { maxWidth: 64 })
    const w = (Math.abs(c.points) / maxAbs) * half
    doc.setFillColor(...((c.points >= 0 ? [220, 38, 38] : [16, 185, 129]) as RGB))
    doc.rect(c.points >= 0 ? barX + half : barX + half - w, y - 2.6, w, 2.6, "F")
    doc.setDrawColor(...ink3).setLineWidth(0.2).line(barX + half, y - 3.4, barX + half, y + 0.6)
    doc.setFontSize(8.5).setTextColor(...ink2).text(pdfText(signed(c.points)), W - M, y, { align: "right" })
  }

  // footer
  const ev = meta.evaluation, ext = meta.external_validation
  doc.setDrawColor(...rule).setLineWidth(0.3).line(M, 191, W - M, 191)
  doc.setFontSize(7.5).setTextColor(...ink3)
  if (ev) {
    const auc = (t: "LAD" | "LCX" | "RCA") => ev["v2_two_step_vessels (deployed)"][t].auc.toFixed(2)
    doc.text(pdfText(`Validation: 10x repeated nested 5-fold cross-validation on ${meta.n_patients} patients, ROC-AUC CAD ${ev.v2_calibrated_with_threshold.Cath.auc.toFixed(2)}, LAD ${auc("LAD")}, LCX ${auc("LCX")}, RCA ${auc("RCA")}.`
      + (ext ? ` Basic 7-input model checked on 5 hospitals (${ext.n_patients.toLocaleString("en")} patients): mean AUC ${ext.loco_auc[ext.chosen_model].Mean.toFixed(2)}.` : "")),
      M, 195.5, { maxWidth: W - 2 * M })
  }
  doc.text("Data: Z-Alizadeh Sani extension (UCI #411, CC BY 4.0). Heart model: HuBMAP Human Reference Atlas, female heart v1.0 by Kristen Browne (CC BY 4.0). Made with flowstate.",
    M, 200, { maxWidth: W - 2 * M })

  const slug = patientLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  doc.save(`flowstate-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
