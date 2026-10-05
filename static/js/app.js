// flowstate: dashboard logic (patient table, API calls, figure panels, explanations)
import { createHeartViewer, riskScore, riskColor } from "./heart.js";

const $ = (id) => document.getElementById(id);
const pct = (p) => `${Math.round(p * 100)}%`;
// Risks are never shown as 0% or 100%: no model is that certain
const pctRisk = (p) => (p >= 0.995 ? ">99%" : p < 0.005 ? "<1%" : pct(p));
const signed = (p) => `${p >= 0 ? "+" : "−"}${Math.abs(p * 100).toFixed(1)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TARGETS = ["Cath", "LAD", "LCX", "RCA"];
const VESSELS = ["LAD", "LCX", "RCA"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Plain-words mode: everyday names for patients and non-cardiologists
const PLAIN = { Cath: "Any heart artery", LAD: "Front artery", LCX: "Side artery", RCA: "Right artery" };
const TECH = { Cath: "CAD", LAD: "LAD", LCX: "LCX", RCA: "RCA" };
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: keep defaults */ } },
};

const state = {
  plain: store.get("flowstate-plain") === "1",
  meta: null,
  inputs: {},
  prediction: null,
  explainTarget: "Cath",
  showAll: false,
  example: null,      // the study patient currently loaded, with its held-out predictions
  edited: false,      // true once any value has been changed by hand
  selectedVessel: null,
  patientLabel: "",
  mode: "risk",       // panel B and the heart: "risk" (each artery's risk) or "cond" (which artery, if CAD)
  fromBlank: true,    // the form started blank (new patient), so untouched values are only assumed
  touched: new Set(), // form ids the user has entered
};
let viewer;
let predictTimer;
let requestId = 0;
const dotRows = {};

// ---------------------------------------------------------------- startup
async function init() {
  setupGuide();
  const slow = setTimeout(() => {
    $("caption-text").textContent = "Waking up the model. On the free server the first load can take up to a minute.";
  }, 2500);
  const res = await fetch("api/meta");
  clearTimeout(slow);
  if (!res.ok) throw new Error(`api/meta returned ${res.status}`);
  state.meta = await res.json();

  viewer = createHeartViewer($("heart-canvas"), { onSelect: (v) => selectVessel(v, false), reduceMotion });
  if (reduceMotion) { $("opt-beat").checked = false; viewer.setBeating(false); }
  viewer.setTorso($("opt-torso").checked);
  $("opt-torso").addEventListener("change", (e) => viewer.setTorso(e.target.checked));
  $("opt-territory").addEventListener("change", (e) => viewer.setTerritories(e.target.checked));
  $("opt-beat").addEventListener("change", (e) => viewer.setBeating(e.target.checked));
  $("btn-reset").addEventListener("click", () => viewer.resetView());
  $("btn-pdf").addEventListener("click", savePdf);
  $("opt-plain").checked = state.plain;
  $("opt-plain").addEventListener("change", (e) => {
    state.plain = e.target.checked;
    store.set("flowstate-plain", state.plain ? "1" : "0");
    applyWording();
  });
  for (const b of document.querySelectorAll("#b-mode button")) {
    b.addEventListener("click", () => {
      state.mode = b.dataset.mode;
      for (const o of document.querySelectorAll("#b-mode button")) o.setAttribute("aria-pressed", String(o === b));
      applyWording();
    });
  }
  $("btn-all-factors").addEventListener("click", () => {
    state.showAll = !state.showAll;
    renderExplanation();
  });

  setupDrawer();
  buildPatientSelect();
  buildForm();
  buildDotplot();
  buildTabs();
  renderMetrics();
  applyWording();
  loadMedian();
}

// ---------------------------------------------------------------- first-visit guide
function setupGuide() {
  const guide = $("guide");
  guide.hidden = store.get("flowstate-guide") === "hidden";
  $("btn-guide-close").addEventListener("click", () => {
    guide.hidden = true;
    store.set("flowstate-guide", "hidden");
  });
}

// ---------------------------------------------------------------- plain words
const nameOf = (t) => (state.plain ? PLAIN : TECH)[t];

function applyWording() {
  $("opt-plain").checked = state.plain;
  $("headline-title").textContent = state.plain ? "Chance of narrowed heart arteries" : "Overall coronary artery disease";
  $("b-text").textContent = state.mode === "cond"
    ? (state.plain ? "If arteries are narrowed: which one" : "If CAD is present: which artery")
    : (state.plain ? "Chance each artery is at least half blocked" : "Probability of 50% or more narrowing");
  viewer.setLabelNames(state.plain ? PLAIN : TECH);
  for (const t of TARGETS) {
    dotRows[t].querySelector(".dp-name b").textContent = nameOf(t);
    const tab = $(`tab-${t}`);
    if (tab) tab.textContent = nameOf(t);
  }
  if (state.prediction) render();
  if ($("truth")) renderTruth();
}

// ---------------------------------------------------------------- print the figure as one page
// One image of the heart with its artery labels drawn in, so they stay aligned at any size
async function heartImage() {
  const holder = $("heart-canvas");
  const shot = new Image();
  shot.src = viewer.snapshot(2.5);
  await shot.decode();
  const box = holder.getBoundingClientRect();
  const k = shot.naturalWidth / box.width;
  const canvas = Object.assign(document.createElement("canvas"), { width: shot.naturalWidth, height: shot.naturalHeight });
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";                                    // white behind the transparent 3D canvas
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(shot, 0, 0);
  g.textBaseline = "middle";
  for (const label of holder.querySelectorAll(".vessel-label")) {
    const r = label.getBoundingClientRect();
    if (!r.width) continue;
    const x = (r.left - box.left) * k, y = (r.top - box.top) * k, w = r.width * k, h = r.height * k;
    g.fillStyle = "#f9faf8"; g.strokeStyle = "#c9cdc6"; g.lineWidth = k;
    g.beginPath(); g.roundRect(x, y, w, h, 4 * k); g.fill(); g.stroke();
    const sw = label.querySelector(".sw");
    g.fillStyle = sw.style.background || "#c9cdc6";
    g.fillRect(x + 7 * k, y + h / 2 - 5 * k, 10 * k, 10 * k);
    g.fillStyle = "#14171c";
    g.font = `750 ${13 * k}px "Public Sans", sans-serif`;
    const name = label.querySelector(".nm").textContent;
    g.fillText(name, x + 23 * k, y + h / 2);
    const nameWidth = g.measureText(name).width;
    g.fillStyle = "#444a54";
    g.font = `400 ${13 * k}px "Public Sans", sans-serif`;
    g.fillText(label.querySelector(".pct").textContent, x + 23 * k + nameWidth + 6 * k, y + h / 2);
  }
  // crop to the heart and its labels (everything that is not plain white), with a small margin
  const { data, width, height } = g.getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return { url: canvas.toDataURL("image/jpeg", 0.92), w: canvas.width, h: canvas.height };
  const pad = Math.round(0.04 * Math.max(x1 - x0, y1 - y0));
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width, x1 + pad); y1 = Math.min(height, y1 + pad);
  const crop = Object.assign(document.createElement("canvas"), { width: x1 - x0, height: y1 - y0 });
  crop.getContext("2d").drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return { url: crop.toDataURL("image/jpeg", 0.92), w: crop.width, h: crop.height };
}

// ---------------------------------------------------------------- PDF report (jsPDF, loaded on first use)
let jsPdfLoading = null;
function loadJsPdf() {
  jsPdfLoading ??= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), {
      src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    });
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => { jsPdfLoading = null; reject(new Error("The PDF library could not be loaded.")); };
    document.head.append(s);
  });
  return jsPdfLoading;
}

const rgb = (hexColour) => [1, 3, 5].map((i) => parseInt(hexColour.slice(i, i + 2), 16));
const pdfText = (s) => String(s).replace(/\u2212/g, "-").replace(/\u2265/g, ">=");   // keep to the standard PDF fonts

async function savePdf() {
  if (!state.prediction) return;
  const btn = $("btn-pdf");
  const label = btn.querySelector(".btn-label");
  btn.disabled = true;
  label.textContent = "Preparing";
  try {
    const [JsPDF, heart] = await Promise.all([loadJsPdf(), heartImage()]);
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const p = state.prediction, ink = [20, 23, 28], ink2 = [68, 74, 84], ink3 = [95, 102, 112], rule = [201, 205, 198];
    const W = 297, M = 14;

    // header
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...ink).text("flow", M, 17);
    doc.setTextColor(29, 79, 128).text("state", M + doc.getTextWidth("flow"), 17);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink2)
      .text("Coronary artery disease risk report", M + 30, 17);
    doc.text(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), W - M, 17, { align: "right" });
    doc.setDrawColor(...ink).setLineWidth(0.6).line(M, 20, W - M, 20);
    doc.setFillColor(247, 236, 210).rect(M, 22.5, W - 2 * M, 7, "F");
    doc.setFontSize(8.5).setTextColor(122, 75, 0).text(
      "Educational prototype. Not a medical device or a substitute for coronary angiography.",
      M + 3, 27);

    // patient line
    const age = Math.round(state.inputs.Age), sex = state.inputs.Sex === 1 ? "man" : "woman";
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ink).text(`${state.patientLabel}, ${age}-year-old ${sex}`, M, 38);
    if (state.example) {
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ink2)
        .text(`Angiography result: ${describeLabels(state.example.labels)}.${state.edited ? " Values edited since loading." : ""}`, M, 43);
    }

    // heart figure (left)
    const boxW = 150, boxH = 128;
    const scale = Math.min(boxW / heart.w, boxH / heart.h);
    const iw = heart.w * scale, ih = heart.h * scale;
    doc.addImage(heart.url, "JPEG", M + (boxW - iw) / 2, 48, iw, ih);
    const capY = 48 + ih + 6;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ink).text("Figure 1A.", M, capY);
    doc.setFont("helvetica", "normal").setTextColor(...ink2).text(state.mode === "cond"
      ? "Each coronary artery is coloured by how likely it is to be the narrowed one if CAD is present, against the average patient with CAD."
      : "Each coronary artery is coloured by its predicted risk: green below the model's cut-off, ochre at it, red above it.",
      M + 17, capY, { maxWidth: boxW - 17 });

    // results (right)
    const X = 176;
    const cad = p.cad;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink2).text("Overall coronary artery disease", X, 40);
    doc.setFont("helvetica", "bold").setFontSize(34).setTextColor(...ink).text(pdfText(pctRisk(cad.probability)), X, 55);
    doc.setFontSize(10).setTextColor(...(cad.high ? [163, 43, 34] : [34, 112, 75]))
      .text(cad.high ? "Above cut-off" : "Below cut-off", X + 36, 47);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink2)
      .text(`Rule-out cut-off ${pct(cad.threshold)}, set to catch 90% of CAD patients.`, X + 36, 53, { maxWidth: W - M - X - 36 });

    // probability table
    let y = 66;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text("Probability of 50% or more narrowing", X, y);
    y += 3;
    doc.setDrawColor(...ink).setLineWidth(0.5).line(X, y, W - M, y);
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink3);
    doc.text("Target", X, y); doc.text("Risk", X + 56, y, { align: "right" }); doc.text("Cut-off", X + 76, y, { align: "right" });
    doc.text("Status", X + 82, y);
    if (state.example?.heldout && !state.edited) doc.text("Held-out", W - M, y, { align: "right" });
    y += 1.8;
    doc.setLineWidth(0.2).line(X, y, W - M, y);
    for (const t of TARGETS) {
      const d = t === "Cath" ? p.cad : p.vessels[t];
      y += 6.2;
      doc.setFillColor(...rgb(hex(d.probability, d.threshold))).rect(X, y - 3, 3, 3, "F");
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ink).text(nameOf(t), X + 5, y);
      doc.setFont("helvetica", t === "Cath" ? "bold" : "normal").text(pctRisk(d.probability), X + 56, y, { align: "right" });
      doc.setFont("helvetica", "normal").setTextColor(...ink2).text(pct(d.threshold), X + 76, y, { align: "right" });
      doc.text(d.high ? "above" : "below", X + 82, y);
      if (state.example?.heldout && !state.edited) doc.text(pctRisk(state.example.heldout[t]), W - M, y, { align: "right" });
    }
    y += 2.5;
    doc.setDrawColor(...ink).setLineWidth(0.5).line(X, y, W - M, y);
    if (state.example?.heldout && !state.edited) {
      y += 4.5;
      doc.setFontSize(7.5).setTextColor(...ink3).text("Held-out: prediction from a model that never saw this patient.", X, y);
    }

    // reasons (CAD)
    y += 9;
    const ex = p.explanations.Cath;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ink).text("Why this prediction? (overall CAD)", X, y);
    y += 4.5;
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ink2).text(
      `Typical study patient ${pctRisk(ex.base)}, this patient ${pctRisk(ex.probability)}. Each bar is a factor's share of the difference, in percentage points.`,
      X, y, { maxWidth: W - M - X });
    y += 5;
    const top = ex.contributions.slice(0, 8);
    const maxAbs = Math.max(...ex.contributions.map((c) => Math.abs(c.points)), 1e-6);
    const barX = X + 66, half = 13;
    for (const c of top) {
      y += 7;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink).text(pdfText(c.label), X, y - 0.8, { maxWidth: 64 });
      doc.setTextColor(...ink3).setFontSize(7).text(pdfText(c.text), X, y + 2.3, { maxWidth: 64 });
      const w = (Math.abs(c.points) / maxAbs) * half;
      doc.setFillColor(...(c.points >= 0 ? [200, 53, 43] : [47, 154, 104]));
      doc.rect(c.points >= 0 ? barX + half : barX + half - w, y - 2.6, w, 2.6, "F");
      doc.setDrawColor(...ink).setLineWidth(0.2).line(barX + half, y - 3.4, barX + half, y + 0.6);
      doc.setFontSize(8.5).setTextColor(...ink2).text(pdfText(signed(c.points)), W - M, y, { align: "right" });
    }

    // footer
    const ev = state.meta.evaluation, ext = state.meta.external_validation;
    const auc = (t) => (t === "Cath" ? ev["v2_calibrated_with_threshold"].Cath : ev["v2_two_step_vessels (deployed)"][t]).auc.toFixed(2);
    doc.setDrawColor(...rule).setLineWidth(0.3).line(M, 191, W - M, 191);
    doc.setFontSize(7.5).setTextColor(...ink3);
    doc.text(pdfText(`Validation: 10x repeated nested 5-fold cross-validation on 303 patients, ROC-AUC CAD ${auc("Cath")}, LAD ${auc("LAD")}, LCX ${auc("LCX")}, RCA ${auc("RCA")}.`
      + (ext ? ` Basic 7-input model checked on 5 hospitals (${ext.n_patients.toLocaleString("en")} patients): mean AUC ${ext.loco_auc[ext.chosen_model].Mean.toFixed(2)}.` : "")), M, 195.5, { maxWidth: W - 2 * M });
    doc.text("Data: Z-Alizadeh Sani extension (UCI #411, CC BY 4.0). Heart model: HuBMAP Human Reference Atlas, female heart v1.0 by Kristen Browne (CC BY 4.0). Made with flowstate.",
      M, 200, { maxWidth: W - 2 * M });

    const slug = state.patientLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    doc.save(`flowstate-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error(err);
    showError(`${err.message} Use your browser's print menu to save a PDF instead.`);
  } finally {
    btn.disabled = false;
    label.textContent = "Save PDF";
  }
}

// ---------------------------------------------------------------- Table 1 as a drawer (below 1280px)
function setupDrawer() {
  const triggers = [...document.querySelectorAll(".js-open-patient")];
  const close = $("btn-close-patient"), scrim = $("scrim");
  let opener = triggers[0];
  const isOpen = () => document.body.classList.contains("drawer-open");
  const open = (on) => {
    document.body.classList.toggle("drawer-open", on);
    for (const t of triggers) t.setAttribute("aria-expanded", String(on));
    scrim.hidden = !on;
    (on ? close : opener).focus();
  };
  for (const t of triggers) t.addEventListener("click", () => { opener = t; open(!isOpen()); });
  close.addEventListener("click", () => open(false));
  scrim.addEventListener("click", () => open(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) open(false); });
}

// ---------------------------------------------------------------- patient selector
function describeLabels(labels) {
  if (!labels.Cath) return "no CAD";
  const vessels = VESSELS.filter((v) => labels[v]);
  return `CAD${vessels.length ? ` (${vessels.join(", ")})` : ""}`;
}

function buildPatientSelect() {
  const sel = $("patient-select");
  sel.add(new Option("New patient (blank form)", "median"));
  const group = Object.assign(document.createElement("optgroup"), { label: "Example patients from the study" });
  for (const p of state.meta.patients) {
    group.append(new Option(`Example ${p.index + 1}: ${p.age}-year-old ${p.sex === 1 ? "man" : "woman"}`, String(p.index)));
  }
  sel.append(group);
  sel.addEventListener("change", () => (sel.value === "median" ? loadMedian() : loadPatient(Number(sel.value))));
}

async function loadPatient(index) {
  const res = await fetch(`api/patients/${index}`);
  if (!res.ok) { showError(`Could not load example patient ${index + 1} (server returned ${res.status}).`); return; }
  const data = await res.json();
  $("patient-select").value = String(index);
  state.inputs = { ...data.inputs };
  state.patientLabel = `Example patient ${index + 1}`;
  state.example = { labels: data.labels, heldout: data.heldout };
  state.edited = false;
  state.fromBlank = false;
  state.touched = new Set();
  clearFind();
  renderTruth();
  writeForm();
  predictNow();
}

function loadMedian() {
  state.inputs = {};
  // A blank form: typical (median) measurements, every symptom and finding absent until entered
  for (const f of state.meta.fields) state.inputs[f.key] = f.kind === "binary" ? 0 : f.median;
  $("patient-select").value = "median";
  state.patientLabel = "New patient";
  state.example = null;
  state.edited = false;
  state.fromBlank = true;
  state.touched = new Set();
  clearFind();
  renderTruth();
  writeForm();
  predictNow();
}

// ---------------------------------------------------------------- Table 1 form
// The key inputs come first: entered alone they give almost the full accuracy (train.py, "input_sets").
// Everything else is grouped under "More details", optional, and starts at typical values.
// Values a new patient has not been given yet look pale ("assumed"); entered values look solid.
const controls = new Map();   // form id -> { row, sync } for every row of Table 1
const domId = (id) => `f-${id.replace(/[^a-z0-9]+/gi, "-")}`;

function buildForm() {
  const form = $("patient-form");
  const meta = state.meta;
  const fields = Object.fromEntries(meta.fields.map((f) => [f.key, f]));
  const groups = Object.fromEntries([...meta.composites, ...meta.chip_groups].map((g) => [g.id, g]));
  const make = (id) => (meta.chip_groups.some((g) => g.id === id) ? chipControl(groups[id])
    : groups[id] ? compositeControl(groups[id]) : fieldControl(fields[id]));
  const grouped = new Set(Object.values(groups).flatMap((g) => g.features));
  const keyIds = meta.key_inputs;

  const sets = meta.input_sets;
  const key = Object.assign(document.createElement("section"), { className: "t1-block key-block" });
  key.setAttribute("aria-labelledby", "key-title");
  key.innerHTML = `
    <div class="block-head"><h3 id="key-title">Key inputs</h3><span class="key-progress" id="key-progress"></span></div>
    <p class="block-note">${sets ? `Entered alone, these ${keyIds.length} give almost the full accuracy: AUC ${sets.key.auc.toFixed(3)},
      against ${sets.all.auc.toFixed(3)} with every input. ` : ""}Pale values are typical values, assumed until you enter your own.</p>`;
  const keyBox = Object.assign(document.createElement("div"), { className: "fields" });
  for (const id of keyIds) keyBox.append(make(id));
  key.append(keyBox);

  const more = Object.assign(document.createElement("section"), { className: "t1-block more-block" });
  more.setAttribute("aria-labelledby", "more-title");
  more.innerHTML = `
    <div class="block-head"><h3 id="more-title">More details</h3><span>optional</span></div>
    <input type="search" class="find" id="find-input" placeholder="Find an input" aria-label="Find an input by name" autocomplete="off">
    <p class="find-empty" id="find-empty" hidden>No input matches.</p>`;
  for (const group of meta.groups) {
    const ids = [
      ...Object.values(groups).filter((g) => g.group === group).map((g) => g.id),
      ...meta.fields.filter((f) => f.group === group && !grouped.has(f.key)).map((f) => f.key),
    ].filter((id) => !keyIds.includes(id));
    if (!ids.length) continue;
    const det = document.createElement("details");
    det.dataset.group = group;
    det.innerHTML = `<summary><span>${group}</span><span class="g-count"></span></summary>`;
    const box = Object.assign(document.createElement("div"), { className: "fields" });
    for (const id of ids) box.append(make(id));
    det.append(box);
    more.append(det);
  }
  const clear = Object.assign(document.createElement("button"), { type: "button", className: "link-btn clear-btn", textContent: "Clear all values" });
  clear.addEventListener("click", loadMedian);
  more.append(clear);

  form.append(key, more);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("find-input").addEventListener("input", (e) => applyFind(e.target.value));
}

// One row: the name (with its unit or a plain hint underneath) and its control. data-control is the id that
// panel C's "click to edit" uses.
function makeRow(id, label, note, stacked = false) {
  const row = Object.assign(document.createElement("div"), { className: `field${stacked ? " stack" : ""}` });
  row.dataset.control = id;
  const name = Object.assign(document.createElement("span"), { className: "f-name", id: domId(id), textContent: label });
  if (note) name.append(Object.assign(document.createElement("span"), { className: "unit", textContent: note }));
  row.append(name);
  return row;
}

const noteFor = (f) => (f.key === "BMI" ? `${f.unit}, from weight and height`
  : f.key === "Weight" ? `${f.unit}, used for BMI` : [f.unit, f.hint].filter(Boolean).join(", "));

// A row of buttons that work as radio buttons (arrow keys move the choice). Clicking the chosen button again
// still counts as entering it, so "No" can be confirmed.
function choiceButtons(id, labels, pick, isOn) {
  const box = Object.assign(document.createElement("div"), { className: "opts" });
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-labelledby", domId(id));
  // stacked rows sit on an even grid: short labels in one line, long ones two per line
  const longest = Math.max(...labels.map((t) => t.length));
  box.style.setProperty("--cols", labels.length <= 3 || longest <= 4 ? labels.length : 2);
  const inputs = labels.map((text, i) => {
    const label = Object.assign(document.createElement("label"), { className: "opt" });
    const input = Object.assign(document.createElement("input"), { type: "radio", name: domId(id), value: String(i) });
    input.addEventListener("change", () => pick(i));
    input.addEventListener("click", () => { if (input.checked) pick(i); });
    label.append(input, Object.assign(document.createElement("span"), { textContent: text }));
    box.append(label);
    return input;
  });
  return { box, sync: () => inputs.forEach((input, i) => { input.checked = isOn(i); }) };
}

function fieldControl(f) {
  if (f.kind === "number") return numberControl(f);
  const values = f.kind === "binary" ? [0, 1] : Object.keys(f.options).map(Number);
  const labels = f.kind === "binary" ? ["No", "Yes"] : Object.values(f.options);
  const row = makeRow(f.key, f.label, noteFor(f), values.length > 2);
  const { box, sync } = choiceButtons(f.key, labels, (i) => setInputs(f.key, { [f.key]: values[i] }),
    (i) => Math.round(state.inputs[f.key]) === values[i]);
  row.append(box);
  controls.set(f.key, { row, sync });
  return row;
}

function compositeControl(c) {
  const row = makeRow(c.id, c.label, c.hint, c.options.length > 2);
  const { box, sync } = choiceButtons(c.id, c.options.map((o) => o.label),
    (i) => setInputs(c.id, Object.fromEntries(c.features.map((k, j) => [k, c.options[i].values[j]]))),
    (i) => c.options[i].values.every((v, j) => state.inputs[c.features[j]] === v));
  row.append(box);
  controls.set(c.id, { row, sync });
  return row;
}

// "Select all that apply" buttons, plus "None", which clears them (or confirms that there are none)
function chipControl(g) {
  const row = makeRow(g.id, g.label, g.hint, true);
  const box = Object.assign(document.createElement("div"), { className: "chips" });
  box.setAttribute("role", "group");
  box.setAttribute("aria-labelledby", domId(g.id));
  const chip = (text) => {
    const label = Object.assign(document.createElement("label"), { className: "chip" });
    const input = Object.assign(document.createElement("input"), { type: "checkbox" });
    label.append(input, Object.assign(document.createElement("span"), { textContent: text }));
    box.append(label);
    return input;
  };
  const none = chip("None");
  none.addEventListener("change", () => setInputs(g.id, Object.fromEntries(g.features.map((k) => [k, 0]))));
  const inputs = g.features.map((k, i) => {
    const input = chip(g.labels[i]);
    input.dataset.key = k;
    input.addEventListener("change", () => setInputs(g.id, { [k]: input.checked ? 1 : 0 }));
    return input;
  });
  row.append(box);
  controls.set(g.id, {
    row,
    sync: () => {
      inputs.forEach((input, i) => { input.checked = state.inputs[g.features[i]] === 1; });
      none.checked = inputs.every((input) => !input.checked);
    },
  });
  return row;
}

function numberControl(f) {
  const row = makeRow(f.key, f.label, noteFor(f));
  const input = Object.assign(document.createElement("input"), { type: "number", step: String(f.step), inputMode: "decimal" });
  input.setAttribute("aria-labelledby", domId(f.key));
  input.title = `Range seen in training: ${f.min} to ${f.max}`;
  input.dataset.key = f.key;
  if (f.key === "BMI") input.readOnly = true;
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    const valid = Number.isFinite(v);
    input.setAttribute("aria-invalid", String(!valid));
    if (!valid) return;
    state.inputs[f.key] = v;
    flagRange(row, f, v);
    if (f.key === "Weight" || f.key === "Length") { updateBMI(); markTouched("BMI"); }
    markTouched(f.key);
    schedulePredict();
  });
  row.append(input);
  controls.set(f.key, {
    row,
    sync: () => {
      const v = state.inputs[f.key];
      input.value = String(Math.round(v * 100) / 100);
      input.removeAttribute("aria-invalid");
      flagRange(row, f, v);
    },
  });
  return row;
}

function setInputs(id, values) {
  Object.assign(state.inputs, values);
  controls.get(id)?.sync();
  markTouched(id);
  schedulePredict();
}

function markTouched(id) {
  if (state.touched.has(id)) return;
  state.touched.add(id);
  refreshTouched();
}

// Pale "assumed" rows, the key-input count and the per-group counts
function refreshTouched() {
  const blank = state.fromBlank;
  for (const [id, { row }] of controls) row.classList.toggle("is-assumed", blank && !state.touched.has(id));
  const keyIds = state.meta.key_inputs;
  const done = keyIds.filter((id) => state.touched.has(id)).length;
  const progress = $("key-progress");
  progress.textContent = !blank ? "values from the study" : done === keyIds.length ? `all ${done} entered` : `${done} of ${keyIds.length} entered`;
  progress.classList.toggle("done", blank && done === keyIds.length);
  for (const det of document.querySelectorAll(".more-block details")) {
    const n = [...det.querySelectorAll("[data-control]")].filter((r) => state.touched.has(r.dataset.control)).length;
    det.querySelector(".g-count").textContent = blank && n ? `${n} entered` : "";
  }
}

// "Find an input": filter the optional rows by name; a group name matches all of its rows
function applyFind(query) {
  const q = query.trim().toLowerCase();
  let any = false;
  for (const det of document.querySelectorAll(".more-block details")) {
    const groupHit = det.dataset.group.toLowerCase().includes(q);
    let hits = 0;
    for (const row of det.querySelectorAll(".field")) {
      const hit = !q || groupHit || row.querySelector(".f-name").textContent.toLowerCase().includes(q);
      row.hidden = !hit;
      hits += hit;
    }
    det.hidden = Boolean(q) && !hits;
    if (q) det.open = hits > 0;
    any ||= hits > 0;
  }
  $("find-empty").hidden = !q || any;
}

function clearFind() {
  const input = $("find-input");
  if (input.value) { input.value = ""; applyFind(""); }
}

function flagRange(row, f, v) {
  if (f.kind !== "number") return;
  row.classList.toggle("out-of-range", v < f.min || v > f.max);
}

function updateBMI() {
  const w = state.inputs.Weight, h = state.inputs.Length;
  if (w > 0 && h > 0) {
    state.inputs.BMI = Math.round((w / (h / 100) ** 2) * 10) / 10;
    const el = document.querySelector('[data-key="BMI"]');
    if (el) el.value = state.inputs.BMI;
  }
}

function writeForm() {
  for (const { sync } of controls.values()) sync();
  refreshTouched();
}

// ---------------------------------------------------------------- prediction
// Under the patient selector: how to start, or the truth and the honest held-out prediction for an example
function renderTruth() {
  const truth = $("truth");
  truth.hidden = false;
  if (!state.example) {
    truth.innerHTML = "Starts with typical values and no symptoms or findings. Fill in the key inputs below; everything else is optional. Or choose an example patient from the study.";
    return;
  }
  const { labels, heldout } = state.example;
  let html = `Angiography result: <b>${describeLabels(labels)}</b>.`;
  if (state.edited) {
    html += ` <span class="muted">Values edited, so this is now a new patient.</span>`;
  } else if (heldout) {
    const list = TARGETS.map((t) => `${nameOf(t)} ${esc(pctRisk(heldout[t]))}`).join(", ");
    html += `<br>Held-out prediction, from a model that never saw this patient: <b>${list}</b>.`
      + ` <span class="muted">The live numbers come from the final model, which learned from all 303 patients.</span>`;
  }
  truth.innerHTML = html;
}

function schedulePredict() {
  if (state.example && !state.edited) {
    state.edited = true;
    renderTruth();
  }
  clearTimeout(predictTimer);
  predictTimer = setTimeout(predictNow, 180);
}

async function predictNow() {
  const id = ++requestId;
  let res;
  try {
    res = await fetch("api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: state.inputs }),
    });
  } catch {
    if (id === requestId) showError("Could not reach the server. Check that it is running, then edit any value to retry.");
    return;
  }
  if (id !== requestId) return;
  if (!res.ok) {
    showError(`The server could not score this patient (error ${res.status}). Check the highlighted values and try again.`);
    return;
  }
  state.prediction = await res.json();
  $("predict-error").hidden = true;
  document.body.classList.remove("is-loading");
  render();
}

function showError(message) {
  const el = $("predict-error");
  el.textContent = message;
  el.hidden = false;
}

const hex = (p, t) => `#${riskColor(riskScore(p, t)).getHexString()}`;

// An artery as panel B and the heart show it: its overall risk against the model's cut-off, or, "if CAD is
// present", P(artery | CAD) against the average patient with CAD
function vesselView(v) {
  const d = state.prediction.vessels[v];
  if (state.mode !== "cond" || !state.meta.cad_vessel_rate) return d;
  const avg = state.meta.cad_vessel_rate[v];
  return { probability: d.conditional, threshold: avg, high: d.conditional >= avg };
}

function render() {
  const p = state.prediction;
  const cad = p.cad;

  const risks = {};
  for (const v of VESSELS) {
    const d = vesselView(v);
    risks[v] = { probability: d.probability, score: riskScore(d.probability, d.threshold), high: d.high, text: pctRisk(d.probability) };
  }
  viewer.setRisks(risks);
  viewer.setHeartRate(state.inputs.PR);

  $("cad-pct").textContent = pctRisk(cad.probability);
  document.querySelector(".legend-text span:nth-child(2)").textContent = state.mode === "cond" ? "Average" : "Cut-off";
  const status = $("cad-status");
  status.textContent = state.plain
    ? (cad.high ? "Above the warning line" : "Below the warning line")
    : (cad.high ? "Above cut-off" : "Below cut-off");
  status.className = `status ${cad.high ? "high" : "low"}`;
  $("cad-text").textContent = state.plain
    ? `The warning line is ${pct(cad.threshold)}. It is set so that 9 in 10 people with narrowed arteries are flagged.`
    : `Rule-out cut-off ${pct(cad.threshold)}, set to catch 90% of CAD.`;

  updateDotplot();
  renderCaption();
  renderExplanation();

  const warnCard = $("warn-card");
  warnCard.hidden = !p.warnings.length;
  $("warn-list").innerHTML = p.warnings.map((w) => `<li>${w}</li>`).join("");
}

// ---------------------------------------------------------------- Figure 1A caption
function renderCaption() {
  const age = Math.round(state.inputs.Age);
  const sex = state.inputs.Sex === 1 ? "man" : "woman";
  let text = `${state.patientLabel}, ${age}-year-old ${sex}.`;
  const v = state.selectedVessel;
  if (v) {
    const info = state.meta.vessels[v];
    text += state.plain
      ? ` ${PLAIN[v]} (${v}): the shaded muscle is what it feeds, ${info.territory.toLowerCase()}.`
      : ` ${info.full} (${v}), shaded: ${info.territory.toLowerCase()}.`;
  }
  if (state.mode === "cond") text += " Arteries coloured by which is likely narrowed, if CAD is present.";
  $("caption-text").textContent = text;
}

// ---------------------------------------------------------------- panel B: one shared probability axis
function aucFor(t) {
  const ev = state.meta.evaluation;
  if (!ev) return null;
  const m = t === "Cath" ? ev["v2_calibrated_with_threshold"].Cath : ev["v2_two_step_vessels (deployed)"][t];
  return m ? m.auc : null;
}

function buildDotplot() {
  const plot = $("dotplot");
  for (const t of TARGETS) {
    const isCad = t === "Cath";
    const row = document.createElement("button");
    row.type = "button";
    row.className = `dp-row ${isCad ? "cad" : "tentative"}`;
    row.setAttribute("aria-pressed", "false");
    const auc = aucFor(t);
    row.title = isCad ? "Coronary artery disease in any artery" : state.meta.vessels[t].full;
    row.innerHTML = `
      <span class="dp-name"><b>${isCad ? "CAD" : t}</b>${auc ? `<small>AUC ${auc.toFixed(2)}</small>` : ""}</span>
      <span class="dp-track"><span class="dp-cut"></span><span class="dp-mark"><i></i></span></span>
      <span class="dp-val num"></span>`;
    row.addEventListener("click", () => {
      if (isCad) selectVessel(null, true);
      else selectVessel(state.selectedVessel === t ? null : t, true);
    });
    plot.append(row);
    dotRows[t] = row;
  }
  const axis = document.createElement("div");
  axis.className = "dp-axis";
  axis.setAttribute("aria-hidden", "true");
  axis.innerHTML = `<span></span><span class="dp-scale"><span class="dp-ticks">${[0, 25, 50, 75, 100]
    .map((x) => `<span style="left:${x}%">${x}</span>`).join("")}</span><span class="dp-axis-title">Predicted probability (%)</span></span><span></span>`;
  plot.append(axis);
}

function updateDotplot() {
  const p = state.prediction;
  const cond = state.mode === "cond", loc = state.meta.localisation_auc;
  for (const t of TARGETS) {
    const d = t === "Cath" ? p.cad : vesselView(t);
    const row = dotRows[t];
    row.querySelector(".dp-cut").style.setProperty("--x", d.threshold);
    const mark = row.querySelector(".dp-mark");
    mark.style.setProperty("--x", d.probability);
    mark.style.setProperty("--c", hex(d.probability, d.threshold));
    row.querySelector(".dp-val").textContent = pctRisk(d.probability);
    const auc = t !== "Cath" && cond && loc ? loc[t] : aucFor(t);
    const small = row.querySelector(".dp-name small");
    if (small && auc) small.textContent = `AUC ${auc.toFixed(2)}`;
    const name = t === "Cath" ? (state.plain ? PLAIN.Cath : "Overall CAD") : nameOf(t) + (cond ? " if CAD is present" : "");
    row.setAttribute("aria-label", `${name}: ${pctRisk(d.probability)}, ${d.high ? "above" : "below"} the ${pct(d.threshold)} ${t !== "Cath" && cond ? "average" : "cut-off"}`
      + (t === "Cath" ? "" : ". Select to show this artery"));
  }
  $("b-note").innerHTML = cond && loc
    ? `Ticks mark the average patient with CAD. Picking the artery is much harder than detecting CAD: among CAD patients these rank at
       AUC ${VESSELS.map((v) => `${v} ${loc[v].toFixed(2)}`).join(", ")} (0.5 is guessing).`
    : "Ticks mark each model's cut-off.";
  markSelection();
}

function markSelection() {
  for (const t of TARGETS) {
    const on = t === "Cath" ? false : state.selectedVessel === t;
    dotRows[t].setAttribute("aria-pressed", String(on));
  }
}

// One control reconfigures every panel: heart camera and territory, panel B, panel C, caption
function selectVessel(v, fromPanel) {
  state.selectedVessel = v;
  if (fromPanel) viewer.select(v);
  state.explainTarget = v || "Cath";
  markSelection();
  if (state.prediction) {
    renderCaption();
    renderExplanation();
  }
}

// ---------------------------------------------------------------- panel C: explanations (SHAP)
function buildTabs() {
  const tabs = $("explain-tabs");
  for (const t of TARGETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `tab-${t}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "explain-panel");
    b.dataset.target = t;
    b.textContent = t === "Cath" ? "CAD" : t;
    b.addEventListener("click", () => {
      const v = t === "Cath" ? null : t;
      viewer.select(v);
      selectVessel(v, false);
    });
    tabs.append(b);
  }
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const i = TARGETS.indexOf(state.explainTarget);
    const next = e.key === "Home" ? 0 : e.key === "End" ? 3 : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
    const btn = tabs.children[next];
    btn.click();
    btn.focus();
    e.preventDefault();
  });
}

function renderExplanation() {
  const t = state.explainTarget;
  for (const b of document.querySelectorAll("#explain-tabs button")) {
    const on = b.dataset.target === t;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $("explain-panel").setAttribute("aria-labelledby", `tab-${t}`);
  const ex = state.prediction.explanations[t];
  const items = state.showAll ? ex.contributions : ex.contributions.slice(0, 8);
  const maxAbs = Math.max(...ex.contributions.map((c) => Math.abs(c.points)), 1e-6);

  // The server reports SHAP values in percentage points of the risk shown, so the bars add up to the difference
  $("explain-summary").innerHTML = state.plain
    ? `A typical patient in the study starts at <b>${esc(pctRisk(ex.base))}</b>; these factors bring this patient to <b>${esc(pctRisk(ex.probability))}</b>. Click one to change it.`
    : `Typical study patient <b>${esc(pctRisk(ex.base))}</b>, this patient <b>${esc(pctRisk(ex.probability))}</b>. Each bar is a factor's share of the difference, in percentage points`
      + (t === "Cath" ? "." : `; “Overall CAD risk” is the part that comes from CAD itself.`);

  $("explain-bars").innerHTML = items.map((c) => {
    const w = (Math.abs(c.points) / maxAbs) * 50;
    const label = c.id === "cad_risk" && state.plain ? "Chance of any narrowing" : c.label;
    const action = c.edit.startsWith("tab:") ? "Click to see why" : "Click to edit";
    return `<button type="button" class="bar-row" data-edit="${esc(c.edit)}" title="${esc(`${label}: ${c.text}. ${action}`)}">
      <span class="lbl"><b>${esc(label)}</b><small>${esc(c.text)}</small></span>
      <span class="bar-track"><span class="bar ${c.points >= 0 ? "up" : "down"}" style="width:${w}%"></span></span>
      <span class="val num">${signed(c.points)}</span>
    </button>`;
  }).join("");
  $("btn-all-factors").textContent = state.showAll ? "Show the top 8 factors" : `Show all ${ex.contributions.length} factors`;

  const cadc = state.prediction.cadc;
  $("cadc-summary").innerHTML = `CAD Consortium clinical score: <b>${cadc.logit.toFixed(2)}</b> log-odds`;
  const rows = cadc.terms.filter((r) => r.points > 0)
    .map((r) => `<tr><td>${r.label}</td><td class="num">+${r.points.toFixed(2)}</td></tr>`).join("");
  $("cadc-box").innerHTML = `
    <table class="booktabs">
      <thead><tr><th>Term (Genders et al., BMJ 2012)</th><th>Points</th></tr></thead>
      <tbody><tr><td>Starting value</td><td class="num">−7.54</td></tr>${rows}</tbody>
      <tfoot><tr><td>Total (log-odds)</td><td class="num">${cadc.logit.toFixed(2)}</td></tr></tfoot>
    </table>
    <p class="note">Means ${pct(cadc.published_probability)} in the lower-risk population it was built on; here it is one model input.</p>`;
}

// Clicking a factor opens its value in Table 1 (the server names the input, or the dropdown, to open);
// "Overall CAD risk" switches to the CAD explanation instead
function focusInput(edit) {
  if (edit.startsWith("tab:")) { $(`tab-${edit.slice(4)}`)?.click(); return; }
  const row = document.querySelector(`#patient-form [data-control="${CSS.escape(edit)}"]`);
  if (!row) return;
  if (row.hidden) clearFind();
  const el = row.querySelector("input:checked") ?? row.querySelector("input");
  if (window.matchMedia("(max-width: 1279px)").matches && !document.body.classList.contains("drawer-open")) {
    document.querySelector(".js-open-patient").click();
  }
  const group = row.closest("details");
  if (group) group.open = true;
  row.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  el?.focus({ preventScroll: true });
  row.classList.remove("flash");
  void row.offsetWidth;
  row.classList.add("flash");
}
document.addEventListener("click", (e) => {
  const row = e.target.closest(".bar-row[data-edit]");
  if (row) focusInput(row.dataset.edit);
});

// ---------------------------------------------------------------- Table 2: validation metrics
function renderMetrics() {
  const ev = state.meta.evaluation;
  const box = $("metrics");
  if (!ev) {
    $("metrics-line").textContent = "Validation results are not bundled with this build.";
    box.innerHTML = `<p class="note">Run <code>python evaluate.py</code> and then <code>python train.py</code> to add them.</p>`;
    return;
  }
  const cath = ev["v2_calibrated_with_threshold"].Cath;
  const deployed = { Cath: cath, ...ev["v2_two_step_vessels (deployed)"] };
  const f = (x) => x.toFixed(2);
  const name = (t) => (t === "Cath" ? "CAD" : t);
  $("metrics-line").textContent = `AUC: ${TARGETS.map((t) => `${name(t)} ${f(deployed[t].auc)}`).join(", ")}`;
  const rows = TARGETS.map((t) => {
    const m = deployed[t];
    return `<tr><td>${name(t)}</td><td class="num">${f(m.auc)} <span class="ci">(${f(m.auc_ci_low)}-${f(m.auc_ci_high)})</span></td>
      <td class="num">${f(m.brier)}</td><td class="num">${f(m.calibration_slope)}</td></tr>`;
  }).join("");
  // Threshold metrics at each model's own cut-off (chosen inside the training folds)
  const hasCut = TARGETS.every((t) => deployed[t].accuracy !== undefined);
  const cutRows = hasCut ? TARGETS.map((t) => {
    const m = deployed[t];
    return `<tr><td>${name(t)}</td><td class="num">${f(m.accuracy)}</td><td class="num">${f(m.ppv)}</td>
      <td class="num">${f(m.sensitivity)}</td><td class="num">${f(m.specificity)}</td><td class="num">${f(m.f1)}</td></tr>`;
  }).join("") : "";
  box.innerHTML = `
    <table class="booktabs">
      <thead><tr><th>Target</th><th>ROC-AUC (95% CI)</th><th>Brier</th><th>Cal. slope</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderCurves()}
    ${hasCut ? `<table class="booktabs">
      <thead><tr><th>At the cut-off</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>Specificity</th><th>F1</th></tr></thead>
      <tbody>${cutRows}</tbody>
    </table>
    <p class="note">Each model's cut-off is chosen inside the training folds: CAD to catch at least 90% of CAD patients (rule-out),
      the arteries by Youden's J. Precision is PPV; recall is sensitivity. CAD NPV ${pct(cath.npv)}.</p>`
    : `<p class="note">CAD at the rule-out cut-off: sensitivity <b>${pct(cath.sensitivity)}</b>, specificity <b>${pct(cath.specificity)}</b>,
      PPV ${pct(cath.ppv)}, NPV ${pct(cath.npv)}.</p>`}
    <p class="note">${state.meta.n_patients} patients. ${ev.protocol} AUC 0.5 is guessing, 1.0 is perfect; calibration slope near 1 means the percentages hold.
    Artery risk = P(CAD) × P(artery | CAD), so it never exceeds CAD.</p>${renderLocalisation()}${renderClinical()}${renderExternal()}`;
}

// ROC and calibration curves of the held-out predictions (train.py), as one two-panel SVG
const SERIES = { Cath: "var(--s-cad)", LAD: "var(--s-lad)", LCX: "var(--s-lcx)", RCA: "var(--s-rca)" };
function renderCurves() {
  const hc = state.meta.heldout_curves;
  if (!hc) return "";
  const S = 146, TOP = 16, LEFT = [42, 246];
  const X = (i, v) => LEFT[i] + v * S, Y = (v) => TOP + (1 - v) * S;
  const xy = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const name = (t) => (t === "Cath" ? "CAD" : t);
  const frame = (i, title, xLabel, yLabel) => [0, 0.5, 1].map((v) => `
      <line class="grid" x1="${X(i, 0)}" x2="${X(i, 1)}" y1="${Y(v)}" y2="${Y(v)}"/>
      <line class="grid" x1="${X(i, v)}" x2="${X(i, v)}" y1="${Y(0)}" y2="${Y(1)}"/>
      <text class="tick" x="${X(i, v)}" y="${Y(0) + 14}" text-anchor="middle">${v}</text>
      <text class="tick" x="${X(i, 0) - 5}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("") + `
      <line class="ref" x1="${X(i, 0)}" y1="${Y(0)}" x2="${X(i, 1)}" y2="${Y(1)}"/>
      <text class="panel-t" x="${X(i, 0)}" y="10">${title}</text>
      <text class="axis-t" x="${X(i, 0.5)}" y="${Y(0) + 30}" text-anchor="middle">${xLabel}</text>
      <text class="axis-t" text-anchor="middle" transform="translate(${X(i, 0) - 31} ${Y(0.5)}) rotate(-90)">${yLabel}</text>`;
  const roc = TARGETS.map((t) => {
    const c = hc.targets[t];
    return `<polyline class="ser" style="stroke:${SERIES[t]}" points="${c.roc.map(([f, s]) => xy(X(0, f), Y(s))).join(" ")}"><title>${name(t)}: AUC ${c.auc.toFixed(2)}</title></polyline>`;
  }).join("");
  const cal = TARGETS.map((t) => {
    const c = hc.targets[t];
    const line = `<polyline class="ser" style="stroke:${SERIES[t]}" points="${c.calibration.map(([pr, ob]) => xy(X(1, pr), Y(ob))).join(" ")}"/>`;
    return line + c.calibration.map(([pr, ob, n], j) => `<circle class="dot" cx="${X(1, pr).toFixed(1)}" cy="${Y(ob).toFixed(1)}" r="4" style="fill:${SERIES[t]}">
      <title>${name(t)}, fifth ${j + 1} (${n} patients): predicted ${pct(pr)}, observed ${pct(ob)}</title></circle>`).join("");
  }).join("");
  const legend = TARGETS.map((t) => `<span><i style="background:${SERIES[t]}"></i>${name(t)}</span>`).join("");
  return `<figure class="curves">
    <div class="curve-legend">${legend}</div>
    <svg viewBox="0 0 400 204" role="img" aria-label="ROC curves and calibration plot of the held-out predictions; the numbers are in the tables">
      ${frame(0, "ROC", "1 − specificity", "Sensitivity")}${roc}${frame(1, "Calibration", "Predicted risk", "Observed rate")}${cal}
    </svg>
    <figcaption class="note">Held-out predictions: each patient scored by a model trained without them. Left: the dashed diagonal is guessing.
      Right: patients split into fifths by predicted risk; points on the diagonal mean the percentages hold.</figcaption>
  </figure>`;
}

// How well the models tell WHICH artery is narrowed, among patients who have CAD
function renderLocalisation() {
  const loc = state.meta.localisation_auc;
  if (!loc) return "";
  return `<p class="note"><b>Which artery?</b> Among patients with CAD, the artery models rank only modestly:
    AUC ${VESSELS.map((v) => `${v} ${loc[v].toFixed(2)}`).join(", ")}. Most of an artery's score comes from detecting CAD at all,
    because the data record ECG and wall-motion findings but not where in the heart they are.
    Panel B's “If CAD is present” view shows the artery-level estimate on its own.</p>`;
}

// flowstate against the scores clinicians use today (clinical_baseline.py)
function renderClinical() {
  const cb = state.meta.clinical_baseline;
  if (!cb) return "";
  const names = { "ESC 2019 pre-test probability": "ESC 2019 pre-test", "CAD Consortium clinical score": "CAD Consortium", flowstate: "flowstate" };
  const rows = Object.entries(cb.methods).map(([name, m]) => `<tr${name === "flowstate" ? ' class="t2-ours"' : ""}>
    <td>${names[name] ?? name}</td>
    <td class="num">${m.auc.toFixed(2)} <span class="ci nowrap">(${m.auc_ci95[0].toFixed(2)}-${m.auc_ci95[1].toFixed(2)})</span></td>
    <td class="num">${pct(m.specificity_at_90_sensitivity)}</td></tr>`).join("");
  const m = cb.methods, d = (k) => m[k].flowstate_auc_minus_this;
  const gain = (k) => `+${d(k)[0].toFixed(2)} (95% CI ${d(k)[1].toFixed(2)} to ${d(k)[2].toFixed(2)})`;
  const escRule = cb.esc_rule_ptp_over_15, ours = cb.flowstate_rule_out_cut_off;
  return `
    <h3 class="t2-sub">Against today's clinical scores</h3>
    <table class="booktabs">
      <thead><tr><th>Method</th><th>ROC-AUC (95% CI)</th><th>Specificity*</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">Same ${cb.n_patients} patients; flowstate uses held-out predictions. *At ${pct(cb.sensitivity_target)} sensitivity, each method at its own
      best cut-off: the share of patients without CAD it would spare an angiogram. AUC gain over ESC ${gain("ESC 2019 pre-test probability")},
      over CAD Consortium ${gain("CAD Consortium clinical score")}.</p>
    <p class="note">The ESC rule (test when pre-test probability is above 15%) misses <b>${escRule.missed_cad_patients}</b> CAD patients.
      flowstate's rule-out cut-off, chosen inside the training folds, misses about <b>${Math.round(ours.missed_cad_patients)}</b> and still spares more
      patients without CAD (specificity ${pct(ours.specificity)} against ${pct(escRule.specificity)}).
      flowstate has the highest net benefit on a decision curve from 10% to 85%, even with both scores recalibrated to these patients.</p>`;
}

// Five-hospital check of a basic-input CAD model (external_validation.py)
const HOSPITAL = { Tehran: ["Tehran", "Iran"], Cleveland: ["Cleveland", "USA"], Hungary: ["Budapest", "Hungary"],
  Switzerland: ["Zurich, Basel", "Switzerland"], "Long Beach": ["Long Beach", "USA"] };
function renderExternal() {
  const ext = state.meta.external_validation;
  if (!ext) return "";
  const rows = ext.calibration.map((c) => `<tr><td>${(HOSPITAL[c.hospital] ?? [c.hospital])[0]} <span class="ci">${(HOSPITAL[c.hospital] ?? [])[1] ?? ""}</span></td>
    <td class="num">${c.n}</td><td class="num">${pct(ext.hospitals[c.hospital].cad_rate)}</td>
    <td class="num">${c.auc.toFixed(2)} <span class="ci">(${c.ci95[0].toFixed(2)}-${c.ci95[1].toFixed(2)})</span></td></tr>`).join("");
  const mean = ext.loco_auc[ext.chosen_model].Mean;
  return `
    <h3 class="t2-sub">Five-hospital check</h3>
    <p class="note">A ${ext.chosen_model.toLowerCase()} on 7 basic inputs (age, sex, chest pain, blood pressure, cholesterol, fasting sugar, resting ECG),
      trained on four hospitals and tested on the fifth, ${ext.n_patients.toLocaleString("en")} patients in all.</p>
    <table class="booktabs">
      <thead><tr><th>Held-out hospital</th><th>Patients</th><th>CAD</th><th>ROC-AUC (95% CI)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Mean</td><td></td><td></td><td class="num">${mean.toFixed(2)}</td></tr></tfoot>
    </table>
    <p class="note">Variety beats volume: 303 patients drawn from four hospitals generalise about as well as all ~1,000.
      Percentages shift with each hospital's referral mix, so a new hospital should recalibrate before use.
      This basic model is a check only; the predictions above come from the full 55-input model.</p>`;
}

init().catch((err) => {
  console.error(err);
  $("caption-text").textContent = "The model could not be loaded. Check that the server is running, then reload the page.";
  showError("The model could not be loaded. Check that the server is running, then reload the page.");
});
