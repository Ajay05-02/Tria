import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TriangleAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HeartView, type ViewOption } from "@/components/HeartView"
import { ModelTab } from "@/components/ModelTab"
import { PatientForm } from "@/components/PatientForm"
import { ResultPanel, type ArteryView } from "@/components/ResultPanel"
import { cn } from "@/lib/utils"
import { pctRisk, riskScore, VESSELS } from "@/lib/format"
import type { HeartViewer, VesselRisk } from "@/lib/heart.js"
import { savePdf } from "@/lib/pdf"
import type { Example, Inputs, Meta, Prediction, Target, Vessel } from "@/lib/types"

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode: keep defaults */ } },
}

// A new patient starts from typical values: study medians, and no symptoms or findings
const blankInputs = (meta: Meta): Inputs =>
  Object.fromEntries(meta.fields.map((f) => [f.key, f.kind === "binary" ? 0 : f.median]))

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [inputs, setInputs] = useState<Inputs>({})
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [example, setExample] = useState<Example | null>(null)
  const [edited, setEdited] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Vessel | null>(null)
  const [explain, setExplain] = useState<Target>("Cath")
  const [mode, setMode] = useState<"risk" | "cond">("risk")
  const [plain, setPlain] = useState(store.get("flowstate-plain") === "1")
  const [view, setView] = useState<ViewOption[]>(reduceMotion ? [] : ["beat"])
  const [tab, setTab] = useState("patient")
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  const [busy, setBusy] = useState(false)
  const viewerRef = useRef<HeartViewer | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const requestId = useRef(0)

  // ---- load the model description, then start with a blank patient
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 2500)
    fetch("api/meta")
      .then((r) => { if (!r.ok) throw new Error(`api/meta returned ${r.status}`); return r.json() })
      .then((m: Meta) => { setMeta(m); setInputs(blankInputs(m)) })
      .catch(() => setError("The model could not be loaded. Check that the server is running, then reload the page."))
      .finally(() => { clearTimeout(t); setSlow(false) })
    return () => clearTimeout(t)
  }, [])

  // ---- predict 180 ms after the last change; ignore answers to older requests
  useEffect(() => {
    if (!meta) return
    const t = setTimeout(async () => {
      const id = ++requestId.current
      try {
        const r = await fetch("api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs }) })
        if (id !== requestId.current) return
        if (!r.ok) { setError(`The server could not score this patient (error ${r.status}). Check the values and try again.`); return }
        setPrediction(await r.json())
        setError(null)
      } catch {
        if (id === requestId.current) setError("Could not reach the server. Check that it is running, then edit any value to retry.")
      }
    }, 180)
    return () => clearTimeout(t)
  }, [inputs, meta])

  const changeInputs = useCallback((id: string, values: Inputs) => {
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

  const choosePatient = useCallback(async (value: string) => {
    if (!meta) return
    setEdited(false)
    setTouched(new Set())
    if (value === "new") { setExample(null); setInputs(blankInputs(meta)); return }
    const r = await fetch(`api/patients/${value}`)
    if (!r.ok) { setError(`Could not load example patient ${Number(value) + 1}.`); return }
    const d = await r.json()
    setExample({ index: d.index, labels: d.labels, heldout: d.heldout })
    setInputs(d.inputs)
  }, [meta])

  const selectVessel = useCallback((v: Vessel | null) => { setSelected(v); setExplain(v ?? "Cath") }, [])
  const chooseExplain = useCallback((t: Target) => { setExplain(t); setSelected(t === "Cath" ? null : t) }, [])
  const editFactor = useCallback((edit: string) => {
    if (edit.startsWith("tab:")) { chooseExplain("Cath"); return }
    setTab("patient")
    setFocus({ id: edit, n: Date.now() })
  }, [chooseExplain])

  // ---- what the arteries show: overall risk against the cut-off, or P(artery | CAD) against the average CAD patient
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
    ? `${patientLabel}, ${Math.round(inputs.Age)}-year-old ${inputs.Sex === 1 ? "man" : "woman"}${selected ? ` · ${meta.vessels[selected].full}: ${meta.vessels[selected].territory.toLowerCase()}` : ""}`
    : slow ? "Waking up the model. On the free server the first load can take up to a minute." : "Loading"

  const makePdf = async () => {
    if (!meta || !prediction || !viewerRef.current || !stageRef.current) return
    setBusy(true)
    try {
      await savePdf({ viewer: viewerRef.current, stage: stageRef.current, meta, prediction, inputs, patientLabel, example, edited, mode, plain })
    } catch (e) {
      setError(`${(e as Error).message} Use your browser's print menu to save a PDF instead.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-muted/40 xl:h-svh">
        <header className="z-20 border-b bg-background">
          <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
            <div className="flex items-center gap-2">
              <img src="logo.svg" alt="" className="size-7" />
              <span className="text-base font-semibold tracking-tight">flowstate</span>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="patient">Patient</TabsTrigger>
                <TabsTrigger value="model">Model</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="ml-auto flex items-center gap-2">
              <Switch id="plain" checked={plain} onCheckedChange={(on) => { setPlain(on); store.set("flowstate-plain", on ? "1" : "0") }} />
              <Label htmlFor="plain" className="text-sm font-normal">Plain words</Label>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t bg-amber-50 px-4 py-1.5 text-xs text-amber-900 lg:px-6">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span><span className="font-semibold">Educational prototype.</span> Not a medical device or a substitute for coronary angiography.</span>
          </div>
        </header>

        {error && (
          <div className="px-4 pt-4 lg:px-6">
            <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}

        {/* Patient tab (kept mounted so the 3D scene is not rebuilt when switching tabs) */}
        <main className={cn("min-h-0 flex-1 gap-4 p-4 lg:p-6", tab === "patient" ? "grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_380px]" : "hidden")}>
          <Card className="order-3 min-h-0 gap-0 py-0 xl:order-1">
            <CardHeader className="border-b py-4"><CardTitle>Patient</CardTitle></CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto py-4">
              {meta && (
                <PatientForm meta={meta} inputs={inputs} touched={touched} fromBlank={!example} example={example} edited={edited}
                  plain={plain} focus={focus} onChange={changeInputs} onPatient={choosePatient} />
              )}
            </CardContent>
          </Card>
          <div className="order-1 h-[58svh] min-h-0 xl:order-2 xl:h-auto">
            <HeartView viewerRef={viewerRef} stageRef={stageRef} risks={risks} selected={selected} plain={plain}
              bpm={inputs.PR ?? 70} view={view} caption={caption} mode={mode} busy={busy}
              onView={setView} onSelect={selectVessel} onPdf={makePdf} />
          </div>
          <div className="order-2 min-h-0 xl:order-3 xl:overflow-y-auto">
            {meta && prediction && arteries ? (
              <ResultPanel meta={meta} prediction={prediction} plain={plain} mode={mode} selected={selected} explain={explain}
                arteries={arteries} onMode={setMode} onSelect={selectVessel} onExplain={chooseExplain} onEdit={editFactor} />
            ) : (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{slow ? "Waking up the model…" : "Loading…"}</CardContent></Card>
            )}
          </div>
        </main>

        {tab === "model" && meta && (
          <main className="flex-1 overflow-y-auto p-4 lg:p-6"><ModelTab meta={meta} /></main>
        )}
      </div>
    </TooltipProvider>
  )
}
