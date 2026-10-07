// flowstate: a guided assessment in the style of Kard (github.com/7-Bala/Kard, MIT).
// Hero → 11 key questions (one per screen) → optional details → analyzing → results (risk ring, 3D heart, reasons)
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { AlertCircle } from "lucide-react"

import { TooltipProvider } from "@/components/ui/tooltip"
import type { ViewOption } from "@/components/HeartView"

import { HeroScreen } from "@/components/flow/HeroScreen"
import { Layout, type Screen } from "@/components/flow/Layout"
import { QuestionScreen } from "@/components/flow/QuestionScreen"
import { ResultsScreen } from "@/components/flow/ResultsScreen"
import { AnalyzingScreen, DetailsScreen, InsightsScreen, LegalScreen } from "@/components/flow/Screens"
import { pctRisk, riskScore, VESSELS } from "@/lib/format"
import type { HeartViewer, VesselRisk } from "@/lib/heart.js"
import { savePdf } from "@/lib/pdf"
import { QUESTIONS } from "@/lib/questions"
import type { ArteryView, Example, Inputs, Meta, Prediction, Target, Vessel } from "@/lib/types"

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

// A new patient starts from typical values: study medians, and no symptoms or findings
const blankInputs = (meta: Meta): Inputs =>
  Object.fromEntries(meta.fields.map((f) => [f.key, f.kind === "binary" ? 0 : f.median]))

const predict = async (inputs: Inputs): Promise<Prediction> => {
  const r = await fetch("api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs }) })
  if (!r.ok) throw new Error(`The server could not score this patient (error ${r.status}).`)
  return r.json()
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [inputs, setInputs] = useState<Inputs>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [notSureSet, setNotSureSet] = useState<Set<string>>(new Set())
  const [example, setExample] = useState<Example | null>(null)
  const [edited, setEdited] = useState(false)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [screen, setScreen] = useState<Screen>("hero")
  const [back, setBack] = useState<Screen>("hero")        // where Insights / About / Privacy / Terms return to
  const [qIndex, setQIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [fromResults, setFromResults] = useState(false)   // editing an answer from the results page
  const [mode, setMode] = useState<"risk" | "cond">("risk")
  const [selected, setSelected] = useState<Vessel | null>(null)
  const [explain, setExplain] = useState<Target>("Cath")
  const [view, setView] = useState<ViewOption[]>(reduceMotion ? [] : ["beat"])
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewerRef = useRef<HeartViewer | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs

  useEffect(() => {
    fetch("api/meta")
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((m: Meta) => { setMeta(m); setInputs(blankInputs(m)) })
      .catch(() => setError("The model could not be loaded. Check that the server is running, then reload the page."))
  }, [])

  useEffect(() => { window.scrollTo({ top: 0 }) }, [screen, qIndex])

  const go = (s: Screen) => { if (!["insights", "about", "privacy", "terms"].includes(screen)) setBack(screen); setScreen(s) }

  const change = useCallback((id: string, values: Inputs) => {
    setInputs((prev) => {
      const next = { ...prev, ...values }
      if (("Weight" in values || "Length" in values) && next.Weight > 0 && next.Length > 0) {
        next.BMI = Math.round((next.Weight / (next.Length / 100) ** 2) * 10) / 10
      }
      return next
    })
    setTouched((prev) => new Set(prev).add(id))
    if (example) setEdited(true)
  }, [example])

  // Score the current answers (the "Analyzing" screen stays at least 0.6 s so it does not flicker)
  const analyze = async () => {
    setScreen("analyzing")
    setFromResults(false)
    try {
      const [p] = await Promise.all([predict(inputsRef.current), new Promise((r) => setTimeout(r, 600))])
      setPrediction(p)
      setError(null)
      setScreen("results")
    } catch (e) {
      setError((e as Error).message || "Could not reach the server.")
      setScreen(QUESTIONS.length ? "details" : "hero")
    }
  }

  const start = () => {
    if (!meta) return
    setExample(null); setEdited(false); setTouched(new Set()); setNotSureSet(new Set()); setInputs(blankInputs(meta))
    setSelected(null); setExplain("Cath"); setMode("risk"); setFromResults(false)
    setDirection(1); setQIndex(0); setScreen("question")
  }

  const openExample = async (index: number) => {
    const r = await fetch(`api/patients/${index}`)
    if (!r.ok) { setError(`Could not load example patient ${index + 1}.`); return }
    const d = await r.json()
    setExample({ index: d.index, labels: d.labels, heldout: d.heldout })
    setEdited(false); setTouched(new Set()); setNotSureSet(new Set()); setInputs(d.inputs)
    setSelected(null); setExplain("Cath"); setMode("risk")
    inputsRef.current = d.inputs
    await analyze()
  }

  const q = QUESTIONS[qIndex]
  const answered = (i: number) => !!example || touched.has(QUESTIONS[i].id) || notSureSet.has(QUESTIONS[i].id)
  const next = () => {
    if (qIndex < QUESTIONS.length - 1) { setDirection(1); setQIndex(qIndex + 1) } else setScreen("details")
  }
  const prev = () => { if (qIndex > 0) { setDirection(-1); setQIndex(qIndex - 1) } }
  const jump = (i: number) => {
    const firstOpen = QUESTIONS.findIndex((_, k) => !answered(k))
    const target = Math.min(i, firstOpen === -1 ? QUESTIONS.length - 1 : firstOpen)
    if (target !== qIndex) { setDirection(target > qIndex ? 1 : -1); setQIndex(target) }
  }

  // "Click to edit" from the results: a key question opens its screen, anything else opens the optional details
  const editFactor = (edit: string) => {
    if (edit.startsWith("tab:")) { setExplain("Cath"); setSelected(null); return }
    const k = QUESTIONS.findIndex((x) => x.id === edit)
    setFromResults(true)
    if (k >= 0) { setDirection(-1); setQIndex(k); setScreen("question") }
    else { setFocus({ id: edit, n: Date.now() }); setScreen("details") }
  }

  const selectVessel = (v: Vessel | null) => { setSelected(v); setExplain(v ?? "Cath") }
  const chooseExplain = (t: Target) => { setExplain(t); setSelected(t === "Cath" ? null : t) }

  const arteries = useMemo(() => {
    if (!prediction || !meta) return null
    return Object.fromEntries(VESSELS.map((v) => {
      const d = prediction.vessels[v]
      if (mode === "cond" && meta.cad_vessel_rate) {
        const avg = meta.cad_vessel_rate[v]
        return [v, { probability: d.conditional, threshold: avg, high: d.conditional >= avg }]
      }
      return [v, { probability: d.probability, threshold: d.threshold, high: d.high }]
    })) as Record<Vessel, ArteryView>
  }, [prediction, meta, mode])

  const risks = useMemo(() => arteries && Object.fromEntries(VESSELS.map((v) => {
    const a = arteries[v]
    return [v, { probability: a.probability, score: riskScore(a.probability, a.threshold), high: a.high, text: pctRisk(a.probability) }]
  })) as Record<Vessel, VesselRisk>, [arteries])

  const patientLabel = example ? `Example patient ${example.index + 1}` : "New patient"
  const caption = meta && inputs.Age !== undefined
    ? `${patientLabel}, ${Math.round(inputs.Age)}-year-old ${inputs.Sex === 1 ? "man" : "woman"}${selected ? `. ${meta.vessels[selected].full}: ${meta.vessels[selected].territory.toLowerCase()}` : ""}`
    : ""

  const makePdf = async () => {
    if (!meta || !prediction || !viewerRef.current || !stageRef.current) return
    setBusy(true)
    try {
      await savePdf({ viewer: viewerRef.current, stage: stageRef.current, meta, prediction, inputs, patientLabel, example, edited, mode, plain: false })
    } catch (e) {
      setError(`${(e as Error).message} Use your browser's print menu to save a PDF instead.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <TooltipProvider>
      <Layout screen={screen} total={QUESTIONS.length} current={qIndex} answered={answered}
        onHome={() => setScreen("hero")} onJump={jump} onNavigate={go}>
        {error && (
          <div className="fixed top-20 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
              <p className="flex-1 text-sm font-medium">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 transition-colors hover:text-red-600" aria-label="Dismiss">&times;</button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {screen === "hero" && <HeroScreen key="hero" meta={meta} onStart={start} onExample={openExample} />}

          {screen === "question" && meta && (
            <QuestionScreen key={`q-${qIndex}`} question={q} index={qIndex} total={QUESTIONS.length} direction={direction}
              inputs={inputs} entered={answered(qIndex)} isNotSure={notSureSet.has(q.id)}
              field={q.kind === "number" ? meta.fields.find((f) => f.key === q.key) : undefined}
              onAnswer={(values) => {
                setNotSureSet((prev) => { if (!prev.has(q.id)) return prev; const n = new Set(prev); n.delete(q.id); return n })
                change(q.id, values)
              }}
              onNotSure={(values) => {
                setNotSureSet((prev) => new Set(prev).add(q.id))
                change(q.id, values)
              }}
              onNext={next} onPrev={prev}
              onUpdate={fromResults ? analyze : undefined} />
          )}

          {screen === "details" && meta && (
            <DetailsScreen key="details" meta={meta} inputs={inputs} touched={touched} fromBlank={!example} focus={focus}
              onChange={change} onBack={() => { setDirection(-1); setQIndex(QUESTIONS.length - 1); setScreen("question") }} onDone={analyze} />
          )}

          {screen === "analyzing" && <AnalyzingScreen key="analyzing" />}

          {screen === "results" && meta && prediction && arteries && (
            <ResultsScreen key="results" meta={meta} prediction={prediction} example={example} edited={edited} risks={risks}
              mode={mode} selected={selected} explain={explain} view={view} bpm={inputs.PR ?? 70} caption={caption} busy={busy}
              viewerRef={viewerRef} stageRef={stageRef}
              onMode={setMode} onSelect={selectVessel} onExplain={chooseExplain} onView={setView} onEdit={editFactor}
              onEditAnswers={() => { setFromResults(true); setDirection(-1); setQIndex(0); setScreen("question") }}
              onRetake={start} onPdf={makePdf} />
          )}

          {screen === "insights" && meta && (
            <InsightsScreen key="insights" meta={meta} onBack={() => setScreen(back)} backLabel={back === "results" ? "Back to results" : "Back"} />
          )}

          {(screen === "about" || screen === "privacy" || screen === "terms") && (
            <LegalScreen key={screen} type={screen} onBack={() => setScreen(back)} />
          )}
        </AnimatePresence>
      </Layout>
    </TooltipProvider>
  )
}
