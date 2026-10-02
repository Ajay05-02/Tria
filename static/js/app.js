// CardioVision 3D: dashboard logic (patient table, API calls, figure panels, explanations)
import { createHeartViewer, riskScore, riskColor } from "./heart.js";

const $ = (id) => document.getElementById(id);
const pct = (p) => `${Math.round(p * 100)}%`;
const TARGETS = ["Cath", "LAD", "LCX", "RCA"];
const VESSELS = ["LAD", "LCX", "RCA"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  meta: null,
  inputs: {},
  prediction: null,
  explainTarget: "Cath",
  showAll: false,
  selectedVessel: null,
  patientLabel: "",
};
let viewer;
let predictTimer;
let requestId = 0;
const dotRows = {};

// ---------------------------------------------------------------- startup
async function init() {
  const res = await fetch("api/meta");
  if (!res.ok) throw new Error(`api/meta returned ${res.status}`);
  state.meta = await res.json();

  viewer = createHeartViewer($("heart-canvas"), { onSelect: (v) => selectVessel(v, false), reduceMotion });
  if (reduceMotion) { $("opt-beat").checked = false; viewer.setBeating(false); }
  viewer.setTorso($("opt-torso").checked);
  $("opt-torso").addEventListener("change", (e) => viewer.setTorso(e.target.checked));
  $("opt-territory").addEventListener("change", (e) => viewer.setTerritories(e.target.checked));
  $("opt-beat").addEventListener("change", (e) => viewer.setBeating(e.target.checked));
  $("btn-reset").addEventListener("click", () => viewer.resetView());
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
  await loadPatient(0);
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
  sel.add(new Option("Typical patient (median values)", "median"));
  for (const p of state.meta.patients) {
    sel.add(new Option(`Patient #${p.index}: ${describeLabels(p.labels)}`, String(p.index)));
  }
  sel.addEventListener("change", () => (sel.value === "median" ? loadMedian() : loadPatient(Number(sel.value))));
}

async function loadPatient(index) {
  const res = await fetch(`api/patients/${index}`);
  if (!res.ok) { showError(`Could not load patient #${index} (server returned ${res.status}).`); return; }
  const data = await res.json();
  $("patient-select").value = String(index);
  state.inputs = { ...data.inputs };
  state.patientLabel = `Patient #${index}`;
  const truth = $("truth");
  truth.hidden = false;
  truth.innerHTML = `Angiography: <b>${describeLabels(data.labels)}</b>. Training-set patient, shown as a demonstration.`;
  writeForm();
  predictNow();
}

function loadMedian() {
  state.inputs = {};
  for (const f of state.meta.fields) state.inputs[f.key] = f.median;
  state.patientLabel = "Typical patient (median values)";
  $("truth").hidden = true;
  writeForm();
  predictNow();
}

// ---------------------------------------------------------------- Table 1 form
function buildForm() {
  const form = $("patient-form");
  const composites = state.meta.composites;
  const inComposite = new Set(composites.flatMap((c) => c.features));
  const openGroups = new Set(["Demographics", "Symptoms", "ECG", "Echocardiography"]);

  for (const group of state.meta.groups) {
    const fields = state.meta.fields.filter((f) => f.group === group && !inComposite.has(f.key));
    const comps = composites.filter((c) => c.group === group);
    if (!fields.length && !comps.length) continue;
    const det = document.createElement("details");
    det.open = openGroups.has(group);
    det.innerHTML = `<summary>${group}</summary>`;
    const box = document.createElement("div");
    box.className = "fields";

    for (const c of comps) {
      const row = document.createElement("label");
      row.className = "field";
      const sel = document.createElement("select");
      sel.dataset.composite = c.id;
      c.options.forEach((o, i) => sel.add(new Option(o.label, String(i))));
      sel.addEventListener("change", () => {
        c.options[Number(sel.value)].values.forEach((v, i) => { state.inputs[c.features[i]] = v; });
        schedulePredict();
      });
      row.append(Object.assign(document.createElement("span"), { textContent: c.label }), sel);
      box.append(row);
    }

    for (const f of fields) box.append(fieldControl(f));
    det.append(box);
    form.append(det);
  }
  form.addEventListener("submit", (e) => e.preventDefault());
}

function fieldControl(f) {
  if (f.kind === "binary") {
    // A table cell that reads "Yes" or "No", edited with a checkbox
    const row = document.createElement("label");
    row.className = "field yn-row";
    const input = Object.assign(document.createElement("input"), { type: "checkbox" });
    input.dataset.key = f.key;
    const text = Object.assign(document.createElement("span"), { className: "yn-text" });
    input.addEventListener("change", () => {
      state.inputs[f.key] = input.checked ? 1 : 0;
      text.textContent = input.checked ? "Yes" : "No";
      schedulePredict();
    });
    const cell = Object.assign(document.createElement("span"), { className: "yn" });
    cell.append(input, text);
    row.append(Object.assign(document.createElement("span"), { textContent: f.label }), cell);
    return row;
  }
  const row = document.createElement("label");
  row.className = "field";
  const name = document.createElement("span");
  name.textContent = f.label;
  let note = f.unit;
  if (f.key === "BMI") note = `${f.unit}, from weight and height`;
  if (f.key === "Weight") note = `${f.unit}, used for BMI`;
  if (note) name.append(Object.assign(document.createElement("span"), { className: "unit", textContent: note }));

  let control;
  if (f.kind === "select") {
    control = document.createElement("select");
    for (const [value, label] of Object.entries(f.options)) control.add(new Option(label, value));
  } else {
    control = Object.assign(document.createElement("input"), { type: "number", step: String(f.step), inputMode: "decimal" });
    control.title = `Range seen in training: ${f.min} to ${f.max}`;
    if (f.key === "BMI") control.readOnly = true;
  }
  control.dataset.key = f.key;
  control.addEventListener("input", () => {
    const v = parseFloat(control.value);
    const valid = Number.isFinite(v);
    control.setAttribute("aria-invalid", String(!valid));
    if (!valid) return;
    state.inputs[f.key] = v;
    flagRange(row, f, v);
    if (f.key === "Weight" || f.key === "Length") updateBMI();
    schedulePredict();
  });
  row.append(name, control);
  return row;
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
  const fieldByKey = Object.fromEntries(state.meta.fields.map((f) => [f.key, f]));
  for (const el of document.querySelectorAll("#patient-form [data-key]")) {
    const v = state.inputs[el.dataset.key];
    if (el.type === "checkbox") {
      el.checked = v === 1;
      el.nextElementSibling.textContent = el.checked ? "Yes" : "No";
    }
    else el.value = el.tagName === "SELECT" ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
    el.removeAttribute("aria-invalid");
    const f = fieldByKey[el.dataset.key];
    if (f && el.closest(".field")) flagRange(el.closest(".field"), f, v);
  }
  for (const c of state.meta.composites) {
    const sel = document.querySelector(`[data-composite="${c.id}"]`);
    const current = c.features.map((k) => state.inputs[k]);
    const idx = c.options.findIndex((o) => o.values.every((v, i) => v === current[i]));
    sel.value = String(Math.max(0, idx));
  }
}

// ---------------------------------------------------------------- prediction
function schedulePredict() {
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

function render() {
  const p = state.prediction;
  const cad = p.cad;

  const risks = {};
  for (const v of VESSELS) {
    const d = p.vessels[v];
    risks[v] = { probability: d.probability, score: riskScore(d.probability, d.threshold), high: d.high };
  }
  viewer.setRisks(risks);
  viewer.setHeartRate(state.inputs.PR);

  $("cad-pct").textContent = pct(cad.probability);
  const status = $("cad-status");
  status.textContent = cad.high ? "Above cut-off" : "Below cut-off";
  status.className = `status ${cad.high ? "high" : "low"}`;
  $("cad-text").textContent = `Rule-out cut-off ${pct(cad.threshold)}, set to catch 90% of CAD.`;

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
    text += ` ${info.full} (${v}), shaded: ${info.territory.toLowerCase()}.`;
  }
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
  for (const t of TARGETS) {
    const d = t === "Cath" ? p.cad : p.vessels[t];
    const row = dotRows[t];
    row.querySelector(".dp-cut").style.setProperty("--x", d.threshold);
    const mark = row.querySelector(".dp-mark");
    mark.style.setProperty("--x", d.probability);
    mark.style.setProperty("--c", hex(d.probability, d.threshold));
    row.querySelector(".dp-val").textContent = pct(d.probability);
    const name = t === "Cath" ? "Overall CAD" : t;
    row.setAttribute("aria-label", `${name}: ${pct(d.probability)}, ${d.high ? "above" : "below"} the ${pct(d.threshold)} cut-off`
      + (t === "Cath" ? "" : ". Select to show this artery"));
  }
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

function formatValue(c) {
  const field = state.meta.fields.find((f) => f.key === c.feature);
  if (field?.kind === "binary" || ["EF_lt50", "RWMA_any"].includes(c.feature)) return c.value >= 0.5 ? "yes" : "no";
  if (field?.kind === "select") return field.options[String(Math.round(c.value))] ?? c.value;
  if (["Typical Chest Pain", "Atypical", "Nonanginal"].includes(c.feature)) return c.value >= 0.5 ? "yes" : "no";
  const whole = Math.abs(c.value - Math.round(c.value)) < 1e-9;
  const digits = whole || Math.abs(c.value) >= 100 ? 0 : Math.abs(c.value) >= 10 ? 1 : 2;
  return `${c.value.toFixed(digits).replace(/^-/, "−")}${c.unit ? ` ${c.unit}` : ""}`;
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
  const maxAbs = Math.max(...ex.contributions.map((c) => Math.abs(c.shap)), 1e-6);

  // SHAP explains the forest's raw score; say how it maps to the calibrated figure shown elsewhere
  $("explain-summary").innerHTML = t === "Cath"
    ? `The average patient scores <b>${pct(ex.base)}</b> and this patient <b>${pct(ex.score)}</b>, which calibrates to <b>${pct(state.prediction.cad.probability)}</b>.`
    : `This patient's ${t} score is <b>${pct(ex.score)}</b> (average CAD patient <b>${pct(ex.base)}</b>).`;

  $("explain-bars").innerHTML = items.map((c) => {
    const w = (Math.abs(c.shap) / maxAbs) * 50;
    return `<div class="bar-row" title="${c.label}: ${formatValue(c)}">
      <span class="lbl"><b>${c.label}</b><small>${formatValue(c)}</small></span>
      <span class="bar-track"><span class="bar ${c.shap >= 0 ? "up" : "down"}" style="width:${w}%"></span></span>
      <span class="val num">${c.shap >= 0 ? "+" : "−"}${Math.abs(c.shap * 100).toFixed(1)}</span>
    </div>`;
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
  box.innerHTML = `
    <table class="booktabs">
      <thead><tr><th>Target</th><th>ROC-AUC (95% CI)</th><th>Brier</th><th>Cal. slope</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">CAD at the rule-out cut-off: sensitivity <b>${pct(cath.sensitivity)}</b>, specificity <b>${pct(cath.specificity)}</b>,
      PPV ${pct(cath.ppv)}, NPV ${pct(cath.npv)}.</p>
    <p class="note">${state.meta.n_patients} patients. ${ev.protocol} AUC 0.5 is guessing, 1.0 is perfect; calibration slope near 1 means the percentages hold.
    Artery risk = P(CAD) × P(artery | CAD), so it never exceeds CAD.</p>`;
}

init().catch((err) => {
  console.error(err);
  $("caption-text").textContent = "The model could not be loaded. Check that the server is running, then reload the page.";
  showError("The model could not be loaded. Check that the server is running, then reload the page.");
});
