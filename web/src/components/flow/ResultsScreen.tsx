// Results: the risk and its reasons beside the 3D heart (layout after Kard, github.com/7-Bala/Kard, MIT)
import type { RefObject } from "react"
import { motion } from "framer-motion"
import { FileDown, PencilLine, RotateCcw, TrendingDown, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiskRingSVG } from "@/components/kard/Svgs"
import { HeartView, type ViewOption } from "@/components/HeartView"
import { cn } from "@/lib/utils"
import { describeLabels, pctRisk, signed, VESSELS } from "@/lib/format"
import type { HeartViewer, VesselRisk } from "@/lib/heart.js"
import type { Example, Meta, Prediction, Target, Vessel } from "@/lib/types"

interface Props {
  meta: Meta
  prediction: Prediction
  example: Example | null
  edited: boolean
  risks: Record<Vessel, VesselRisk> | null
  mode: "risk" | "cond"
  selected: Vessel | null
  explain: Target
  view: ViewOption[]
  bpm: number
  caption: string
  busy: boolean
  viewerRef: RefObject<HeartViewer | null>
  stageRef: RefObject<HTMLDivElement | null>
  onMode: (m: "risk" | "cond") => void
  onSelect: (v: Vessel | null) => void
  onExplain: (t: Target) => void
  onView: (v: ViewOption[]) => void
  onEdit: (id: string) => void
  onEditAnswers: () => void
  onRetake: () => void
  onPdf: () => void
}

export function ResultsScreen(p: Props) {
  const cad = p.prediction.cad
  const level = cad.probability < cad.threshold ? "low" : cad.probability < 0.85 ? "medium" : "high"
  const color = level === "high" ? "var(--risk-high)" : level === "medium" ? "var(--risk-med)" : "var(--risk-low)"
  const word = { low: "Lower risk", medium: "Elevated risk", high: "High risk" }[level]
  const ex = p.prediction.explanations[p.explain]

  return (
    <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
      className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:px-8">

      {/* left: the result, its reasons and what to do next */}
      <div className="flex min-w-0 flex-col gap-8">
        {p.example && (
          <p className="text-sm text-muted-foreground">
            Example patient {p.example.index + 1}. Angiography found <span className="font-medium text-foreground">{describeLabels(p.example.labels)}</span>
            {p.example.heldout && !p.edited ? `; a model that never saw this patient predicted ${pctRisk(p.example.heldout.Cath)}.` : "."}
          </p>
        )}

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative size-36 shrink-0" role="img" aria-label={`${word}: ${pctRisk(cad.probability)} chance of coronary artery disease`}>
            <RiskRingSVG value={Math.round(cad.probability * 100)} color={color} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight tabular-nums" style={{ color }}>{pctRisk(cad.probability)}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color }}>{word} of coronary artery disease</p>
            <h2 className="mt-1 text-2xl leading-snug font-semibold tracking-tight">
              {level === "low" ? "A lower chance of narrowed heart arteries." : level === "medium" ? "Some signs of narrowed heart arteries." : "Strong signs of narrowed heart arteries."}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {level === "low"
                ? `Below the model's ${Math.round(cad.threshold * 100)}% cut-off, which is set to catch 9 in 10 people with the disease. A doctor can say what this means for you.`
                : level === "medium"
                  ? "Several answers raise the chance that a heart artery is at least half blocked. Share this result with a doctor, who may suggest further tests."
                  : "These answers match patients who usually had a narrowed artery on angiography. Please discuss this result with a doctor soon."}
            </p>
          </div>
        </div>

        <section aria-labelledby="why-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="why-title" className="text-lg font-semibold">Why this result</h3>
            <Tabs value={p.explain} onValueChange={(t) => p.onExplain(t as Target)}>
              <TabsList>
                {(["Cath", ...VESSELS] as Target[]).map((t) => (
                  <TabsTrigger key={t} value={t} className="px-3 text-xs">{t === "Cath" ? "CAD" : t}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A typical patient in the study starts at {pctRisk(ex.base)}. These answers move it to {pctRisk(ex.probability)}; the numbers are percentage points. Click one to change it.
          </p>
          <ul className="mt-3 divide-y rounded-xl border bg-card" aria-label="Main reasons">
            {ex.contributions.slice(0, 5).map((c) => {
              const up = c.points >= 0
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => p.onEdit(c.edit)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-secondary/60">
                    {up ? <TrendingUp className="size-4 shrink-0 text-[color:var(--risk-high)]" aria-label="Raises the risk" />
                      : <TrendingDown className="size-4 shrink-0 text-[color:var(--risk-low)]" aria-label="Lowers the risk" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{c.id === "cad_risk" ? "Overall CAD risk" : c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.text}</span>
                    </span>
                    <span className={cn("font-semibold tabular-nums", up ? "text-[color:var(--risk-high)]" : "text-[color:var(--risk-low)]")}>{signed(c.points)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="lg" onClick={p.onEditAnswers} className="h-10 rounded-lg"><PencilLine className="mr-1 size-4" /> Edit answers</Button>
          <Button variant="outline" size="lg" onClick={p.onPdf} disabled={p.busy} className="h-10 rounded-lg"><FileDown className="mr-1 size-4" /> {p.busy ? "Preparing" : "Save PDF"}</Button>
          <button onClick={p.onRetake}
            className="ml-1 flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <RotateCcw className="size-3.5" /> New patient
          </button>
        </div>
      </div>

      {/* right: the heart, coloured by risk */}
      <section className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:self-start" aria-labelledby="heart-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="heart-title" className="text-lg font-semibold">The arteries</h3>
          <Tabs value={p.mode} onValueChange={(v) => p.onMode(v as "risk" | "cond")}>
            <TabsList>
              <TabsTrigger value="risk" className="px-3 text-xs">Risk</TabsTrigger>
              <TabsTrigger value="cond" className="px-3 text-xs">If CAD is present</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-[460px] lg:h-[540px]">
          <HeartView viewerRef={p.viewerRef} stageRef={p.stageRef} risks={p.risks} selected={p.selected} plain={false}
            bpm={p.bpm} view={p.view} caption={p.caption} mode={p.mode} busy={p.busy}
            onView={p.onView} onSelect={p.onSelect} onPdf={p.onPdf} showPdf={false} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {p.mode === "cond"
            ? "If CAD is present: which artery is likely narrowed, compared with the average patient with CAD. Telling the arteries apart is the model's weakest part."
            : "Chance that each artery is at least half blocked, coloured against each model's cut-off. Click an artery's label to turn the heart to it."}
        </p>
      </section>
    </motion.div>
  )
}
