// The hand-drawn "Tria" wordmark: an italic hand in one round-ended stroke. One definition, drawn as SVG in the
// header and as vector strokes in the PDF report, so both always show the same lettering.
import type { jsPDF } from "jspdf"

export const WORDMARK = {
  width: 85, height: 45, baseline: 39, stroke: 4.2,
  // absolute M / C / L commands only, so the PDF writer below can read them
  paths: [
    "M3 10.5C7.7 6.6 15.9 5.6 24.7 6.6C32.6 7.5 40.6 7 49.2 3.6M21.1 6.6C18.7 17 15.5 28 13.3 35C12.2 38.4 9.4 40 6.7 38.4",   // T
    "M37.5 22.4C36.3 28 34.7 34 33.4 39M36 29C38.8 24.2 43.3 21.4 47.5 22.8",                                                 // r
    "M55.5 22.4C53.9 28 52.3 34 52.8 37.6C53.3 39.8 55.9 39.4 58.2 37M58.3 12.6L58.3 12.9",                                    // i
    "M77.4 25.4C75.2 20.6 66.2 21 63.5 30.4C61.6 38 68.1 41.6 75.6 33.6M78.6 22.2C76.9 28 75.3 34 76 37.6C76.5 39.8 79.3 39.4 81.8 36.8",   // a
  ],
}

// Draws the wordmark with its left edge at x and its baseline at y (mm); `capHeight` is the height of the T in mm.
// Returns the width used, so the caller can place what follows.
export function drawWordmark(doc: jsPDF, x: number, y: number, capHeight: number, color: [number, number, number]) {
  const s = capHeight / (WORDMARK.baseline - 3.6), top = y - WORDMARK.baseline * s
  doc.setDrawColor(...color).setLineWidth(WORDMARK.stroke * s).setLineCap("round").setLineJoin("round")
  for (const sub of WORDMARK.paths.join("").split("M").filter(Boolean)) {
    const [start, ...segments] = sub.split(/(?=[CL])/)
    const [x0, y0] = start.trim().split(" ").map(Number)
    let px = x0, py = y0
    // jsPDF takes each segment relative to the point before it
    const lines = segments.map((seg) => {
      const n = seg.slice(1).trim().split(" ").map(Number)
      const rel = n.map((v, i) => v - (i % 2 ? py : px))
      px = n[n.length - 2]; py = n[n.length - 1]
      return rel
    })
    doc.lines(lines, x + x0 * s, top + y0 * s, [s, s], "S", false)
  }
  doc.setLineCap("butt").setLineJoin("miter")
  return WORDMARK.width * s
}
