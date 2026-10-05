// Results, after Kard's ResultsScreen (github.com/7-Bala/Kard, MIT), plus flowstate's 3D heart, arteries and reasons
import type { RefObject } from "react"
import { motion } from "framer-motion"
import { ArrowRight, FileDown, PencilLine, RotateCcw, TrendingDown, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiskRingSVG } from "@/components/kard/Svgs"
import { HeartView, type ViewOption } from "@/components/HeartView"

import { cn } from "@/lib/utils"
import { describeLabels, pctRisk, riskHex, signed, VESSELS } from "@/lib/format"
import type { HeartViewer, VesselRisk } from "@/lib/heart.js"
import type { ArteryView, Example, Meta, Prediction, Target, Vessel } from "@/lib/types"

const WHERE: Record<Vessel, string> = { LAD: "front of the heart", LCX: "side and back", RCA: "right side and bottom" }

interface Props {
  meta: Meta
  prediction: Prediction
  example: Example | null
  edited: boolean
  arteries: Record<Vessel, ArteryView>
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
  onInsights: () => void
}

export function ResultsScreen(p: Props) {
  const { meta, prediction, arteries } = p
  const cad = prediction.cad
  const level = cad.probability < cad.threshold ? "low" : cad.probability < 0.85 ? "medium" : "high"
  const color = level === "high" ? "var(--risk-high)" : level === "medium" ? "var(--risk-med)" : "var(--risk-low)"
  const word = { low: "Lower risk", medium: "Elevated risk", high: "High risk" }[level]
  const ex = prediction.explanations[p.explain]
  const factors = ex.contributions.slice(0, 5)

  return (
    <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-6 py-14">

      {p.example && (
        <p className="rounded-full border bg-card px-4 py-1.5 text-center text-xs text-muted-foreground">
          Example patient {p.example.index + 1} · angiography found <span className="font-medium text-foreground">{describeLabels(p.example.labels)}</span>
          {p.example.heldout && !p.edited && <> · held-out prediction {pctRisk(p.example.heldout.Cath)}</>}
        </p>
      )}

      {/* risk ring */}
      <div className="relative size-52" role="img" aria-label={`${word}: ${pctRisk(cad.probability)} chance of coronary artery disease`}>
        <RiskRingSVG value={Math.round(cad.probability * 100)} color={color} />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Chance of CAD</span>
          <span className="font-serif text-4xl font-bold tabular-nums" style={{ color }}>{pctRisk(cad.probability)}</span>
          <span className="mt-1 text-xs font-semibold" style={{ color }}>{word}</span>
        </div>
      </div>

      {/* recommendation */}
      <div className="w-full rounded-3xl border border-border bg-card p-7 shadow-sm">
        <h2 className="mb-3 font-serif text-xl font-semibold text-balance text-foreground">
          {level === "low" ? "A lower chance of narrowed heart arteries." : level === "medium" ? "Some signs of coronary artery disease." : "Strong signs of coronary artery disease."}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {level === "low"
            ? `The answers point below the model's ${Math.round(cad.threshold * 100)}% cut-off, which is set to catch 9 in 10 people with the disease. Keep up regular check-ups; a doctor can say what this means for you.`
            : level === "medium"
              ? "Several answers raise the chance that a heart artery is at least half blocked. Share this result with a doctor, who may suggest further tests."
              : "These answers match patients who usually had a narrowed heart artery on angiography. Please discuss this result with a doctor soon."}
        </p>
      </div>

      {/* the heart and its three arteries */}
      <section className="w-full" aria-labelledby="heart-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Where</p>
            <h3 id="heart-title" className="font-serif text-2xl font-semibold">Your heart, artery by artery</h3>
          </div>
          <Tabs value={p.mode} onValueChange={(v) => p.onMode(v as "risk" | "cond")}>
            <TabsList className="rounded-full">
              <TabsTrigger value="risk" className="rounded-full px-3 text-xs">Risk</TabsTrigger>
              <TabsTrigger value="cond" className="rounded-full px-3 text-xs">If CAD is present</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-[440px]">
          <HeartView viewerRef={p.viewerRef} stageRef={p.stageRef} risks={p.risks} selected={p.selected} plain={false}
            bpm={p.bpm} view={p.view} caption={p.caption} mode={p.mode} busy={p.busy}
            onView={p.onView} onSelect={p.onSelect} onPdf={p.onPdf} showPdf={false} />
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {VESSELS.map((v) => {
            const a = arteries[v]
            const on = p.selected === v
            return (
              <li key={v}>
                <button type="button" onClick={() => p.onSelect(on ? null : v)} aria-pressed={on}
                  className={cn("w-full rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/35",
                    on && "border-primary bg-primary/[0.05]")}>
                  <span className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{v}</span>
                    <span className="font-serif text-xl font-bold tabular-nums" style={{ color: riskHex(a.probability, a.threshold) }}>{pctRisk(a.probability)}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{meta.vessels[v].full.replace(" artery", "")} · {WHERE[v]}</span>
                  <span className="relative mt-2 block h-1.5 rounded-full bg-border">
                    <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.max(3, a.probability * 100)}%`, background: riskHex(a.probability, a.threshold) }} />
                    <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-foreground/60" style={{ left: `${a.threshold * 100}%` }} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {p.mode === "cond"
            ? "If CAD is present: which artery is likely narrowed, against the average patient with CAD (tick). Telling the arteries apart is the model's weakest part."
            : "Chance that each artery is at least half blocked. The tick is each model's cut-off. Click an artery to turn the heart to it."}
        </p>
      </section>

      {/* top contributors */}
      <section className="w-full" aria-labelledby="why-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Why</p>
            <h3 id="why-title" className="font-serif text-2xl font-semibold">Top contributors</h3>
          </div>
          <Tabs value={p.explain} onValueChange={(t) => p.onExplain(t as Target)}>
            <TabsList className="rounded-full">
              {(["Cath", ...VESSELS] as Target[]).map((t) => (
                <TabsTrigger key={t} value={t} className="rounded-full px-3 text-xs">{t === "Cath" ? "CAD" : t}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          A typical patient in the study starts at {pctRisk(ex.base)}; these answers move it to {pctRisk(ex.probability)} (in percentage points). Click one to change it.
        </p>
        <ul className="space-y-2" aria-label="Main reasons">
          {factors.map((c) => {
            const up = c.points >= 0
            return (
              <li key={c.id}>
                <button type="button" onClick={() => p.onEdit(c.edit)}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/35">
                  {up ? <TrendingUp className="size-4 shrink-0 text-destructive" aria-label="Raises the risk" />
                    : <TrendingDown className="size-4 shrink-0 text-[color:var(--risk-low)]" aria-label="Lowers the risk" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{c.id === "cad_risk" ? "Overall CAD risk" : c.label}</span>
                    <span className="text-muted-foreground"> · {c.text}</span>
                  </span>
                  <span className={cn("font-semibold tabular-nums", up ? "text-destructive" : "text-[color:var(--risk-low)]")}>{signed(c.points)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* actions */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button variant="outline" size="lg" onClick={p.onEditAnswers} className="h-12 rounded-full sm:flex-1 font-medium">
          <PencilLine className="mr-1 size-4" /> Edit answers
        </Button>
        <Button variant="outline" size="lg" onClick={p.onPdf} disabled={p.busy} className="h-12 rounded-full sm:flex-1 font-medium">
          <FileDown className="mr-1 size-4" /> {p.busy ? "Preparing" : "Save PDF"}
        </Button>
        <Button size="lg" onClick={p.onInsights} className="h-12 rounded-full sm:flex-1 bg-foreground font-medium text-background hover:bg-foreground/90">
          How accurate is it? <ArrowRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
      </div>
      <button onClick={p.onRetake}
        className="-mt-3 flex items-center gap-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
        <RotateCcw className="size-3.5" /> Start a new patient
      </button>

      <p className="max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
        Based on {meta.n_patients} patients from the Z-Alizadeh Sani study. An educational prototype: not a medical device or a substitute for coronary angiography.
      </p>
    </motion.div>
  )
}
