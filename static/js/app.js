// flowstate: dashboard logic (patient table, API calls, figure panels, explanations)
import { createHeartViewer, riskScore, riskColor } from "./heart.js";

const $ = (id) => document.getElementById(id);
const pct = (p) => `${Math.round(p * 100)}%`;
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
  selectedVessel: null,
  patientLabel: "",
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
  $("btn-print").addEventListener("click", printFigure);
  $("opt-plain").checked = state.plain;
  $("opt-plain").addEventListener("change", (e) => {
    state.plain = e.target.checked;
    store.set("flowstate-plain", state.plain ? "1" : "0");
    applyWording();
  });
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
  await loadPatient(0);
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
  $("b-text").textContent = state.plain ? "Chance each artery is at least half blocked" : "Probability of 50% or more narrowing";
  viewer.setLabelNames(state.plain ? PLAIN : TECH);
  for (const t of TARGETS) {
    dotRows[t].querySelector(".dp-name b").textContent = nameOf(t);
    const tab = $(`tab-${t}`);
    if (tab) tab.textContent = nameOf(t);
  }
  if (state.prediction) render();
}

// ---------------------------------------------------------------- print the figure as one page
async function printFigure() {
  const holder = $("heart-canvas");
  let img = holder.querySelector(".print-shot");
  if (!img) {
    img = Object.assign(document.createElement("img"), { className: "print-shot", alt: "" });
    holder.append(img);
  }
  // One image of the heart with its artery labels drawn in, so they stay aligned at any print size
  const shot = new Image();
  shot.src = viewer.snapshot();
  await shot.decode();
  const box = holder.getBoundingClientRect();
  const k = shot.naturalWidth / box.width;
  const canvas = Object.assign(document.createElement("canvas"), { width: shot.naturalWidth, height: shot.naturalHeight });
  const g = canvas.getContext("2d");
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
  img.src = canvas.toDataURL("image/png");
  await img.decode();
  const table2 = document.querySelector("details.table2");
  const wasOpen = table2.open;
  table2.open = true;
  window.addEventListener("afterprint", () => { table2.open = wasOpen; }, { once: true });
  window.print();
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
    const name = t === "Cath" ? (state.plain ? PLAIN.Cath : "Overall CAD") : nameOf(t);
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
  $("explain-summary").innerHTML = state.plain
    ? `Bars to the right push the risk up, bars to the left bring it down. Click one to change that value.`
    : t === "Cath"
      ? `The average patient scores <b>${pct(ex.base)}</b> and this patient <b>${pct(ex.score)}</b>, which calibrates to <b>${pct(state.prediction.cad.probability)}</b>.`
      : `This patient's ${t} score is <b>${pct(ex.score)}</b> (average CAD patient <b>${pct(ex.base)}</b>).`;

  $("explain-bars").innerHTML = items.map((c) => {
    const w = (Math.abs(c.shap) / maxAbs) * 50;
    return `<button type="button" class="bar-row" data-feature="${c.feature}" title="${c.label}: ${formatValue(c)}. Click to edit">
      <span class="lbl"><b>${c.label}</b><small>${formatValue(c)}</small></span>
      <span class="bar-track"><span class="bar ${c.shap >= 0 ? "up" : "down"}" style="width:${w}%"></span></span>
      <span class="val num">${c.shap >= 0 ? "+" : "−"}${Math.abs(c.shap * 100).toFixed(1)}</span>
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

// Clicking a factor opens its value in Table 1. Engineered features jump to the input they are computed from.
const SOURCE_INPUT = {
  CADC_logit: "Age", ECG_isch_count: "St Depression", EF_lt50: "EF-TTE", RWMA_any: "Region RWMA",
  LV_damage: "EF-TTE", NLR: "Neut", eGFR: "CR", BMI: "Weight",
};
function focusInput(feature) {
  const key = SOURCE_INPUT[feature] ?? feature;
  let el = document.querySelector(`#patient-form [data-key="${CSS.escape(key)}"]`);
  if (!el) {
    const comp = state.meta.composites.find((c) => c.features.includes(feature));
    if (comp) el = document.querySelector(`[data-composite="${comp.id}"]`);
  }
  if (!el) return;
  if (window.matchMedia("(max-width: 1279px)").matches && !document.body.classList.contains("drawer-open")) {
    document.querySelector(".js-open-patient").click();
  }
  const group = el.closest("details");
  if (group) group.open = true;
  el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
  const row = el.closest(".field");
  if (row) {
    row.classList.remove("flash");
    void row.offsetWidth;
    row.classList.add("flash");
  }
}
document.addEventListener("click", (e) => {
  const row = e.target.closest(".bar-row[data-feature]");
  if (row) focusInput(row.dataset.feature);
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
  box.innerHTML = `
    <table class="booktabs">
      <thead><tr><th>Target</th><th>ROC-AUC (95% CI)</th><th>Brier</th><th>Cal. slope</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">CAD at the rule-out cut-off: sensitivity <b>${pct(cath.sensitivity)}</b>, specificity <b>${pct(cath.specificity)}</b>,
      PPV ${pct(cath.ppv)}, NPV ${pct(cath.npv)}.</p>
    <p class="note">${state.meta.n_patients} patients. ${ev.protocol} AUC 0.5 is guessing, 1.0 is perfect; calibration slope near 1 means the percentages hold.
    Artery risk = P(CAD) × P(artery | CAD), so it never exceeds CAD.</p>${renderExternal()}`;
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
