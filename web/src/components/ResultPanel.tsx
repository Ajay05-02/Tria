import { useState } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { nameOf, pct, pctRisk, riskHex, signed, TARGETS, VESSELS } from "@/lib/format"
import type { Meta, Prediction, Target, Vessel } from "@/lib/types"

export type ArteryView = { probability: number; threshold: number; high: boolean }

interface Props {
  meta: Meta
  prediction: Prediction
  plain: boolean
  mode: "risk" | "cond"
  selected: Vessel | null
  explain: Target
  arteries: Record<Vessel, ArteryView>
  onMode: (m: "risk" | "cond") => void
  onSelect: (v: Vessel | null) => void
  onExplain: (t: Target) => void
  onEdit: (id: string) => void
}

export function ResultPanel({ meta, prediction: p, plain, mode, selected, explain, arteries, onMode, onSelect, onExplain, onEdit }: Props) {
  const [showAll, setShowAll] = useState(false)
  const cad = p.cad
  const ex = p.explanations[explain]
  const items = showAll ? ex.contributions : ex.contributions.slice(0, 6)
  const maxAbs = Math.max(...ex.contributions.map((c) => Math.abs(c.points)), 1e-6)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pt-5 pb-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {plain ? "Chance of narrowed heart arteries" : "Coronary artery disease"}
        </CardTitle>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{pctRisk(cad.probability)}</span>
          <div className="mb-1.5 flex flex-col items-start gap-1">
            <Badge variant={cad.high ? "destructive" : "secondary"} className={cn(!cad.high && "bg-emerald-50 text-emerald-700")}>
              {cad.high ? "Above cut-off" : "Below cut-off"}
            </Badge>
            <span className="text-xs text-muted-foreground">Cut-off {pct(cad.threshold)}</span>
          </div>
        </div>
      </CardHeader>

      {p.warnings.length > 0 && (
        <div className="px-4 pb-4">
          <Alert>
            <AlertTriangle />
            <AlertTitle>Check these inputs</AlertTitle>
            <AlertDescription><ul className="list-disc pl-4">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription>
          </Alert>
        </div>
      )}

      <Separator />
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Arteries</h3>
          <Tabs value={mode} onValueChange={(v) => onMode(v as "risk" | "cond")}>
            <TabsList className="h-7">
              <TabsTrigger value="risk" className="text-xs">Risk</TabsTrigger>
              <TabsTrigger value="cond" className="text-xs">If CAD is present</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col gap-1">
          {VESSELS.map((v) => {
            const a = arteries[v]
            const on = selected === v
            return (
              <button key={v} type="button" onClick={() => onSelect(on ? null : v)} aria-pressed={on}
                title={meta.vessels[v].full}
                className={cn("grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                  on && "bg-muted ring-1 ring-foreground/15")}>
                <span className="text-sm font-medium">{nameOf(v, plain)}</span>
                <span className="relative h-2 rounded-full bg-muted-foreground/15">
                  <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.max(2, a.probability * 100)}%`, background: riskHex(a.probability, a.threshold) }} />
                  <span className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/70" style={{ left: `${a.threshold * 100}%` }} />
                </span>
                <span className="text-right text-sm font-medium tabular-nums">{pctRisk(a.probability)}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "cond"
            ? "If CAD is present: which artery is likely narrowed. Ticks mark the average CAD patient."
            : "Chance each artery is narrowed by 50% or more. Ticks mark the cut-off."}
        </p>
      </CardContent>

      <Separator />
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Why this result</h3>
          <Tabs value={explain} onValueChange={(t) => onExplain(t as Target)}>
            <TabsList className="h-7">
              {TARGETS.map((t) => <TabsTrigger key={t} value={t} className="px-2 text-xs">{nameOf(t, plain)}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground">
          Typical patient <span className="font-medium text-foreground">{pctRisk(ex.base)}</span> → this patient{" "}
          <span className="font-medium text-foreground">{pctRisk(ex.probability)}</span>. Click a factor to edit it.
        </p>
        <div className="flex flex-col">
          {items.map((c) => {
            const w = (Math.abs(c.points) / maxAbs) * 50
            const label = c.id === "cad_risk" && plain ? "Chance of any narrowing" : c.label
            return (
              <button key={c.id} type="button" onClick={() => onEdit(c.edit)} title={`${label}: ${c.text}`}
                className="grid grid-cols-[minmax(0,1fr)_6.5rem_3rem] items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.text}</span>
                </span>
                <span className="relative h-2">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/30" />
                  <span className={cn("absolute inset-y-0 rounded-sm", c.points >= 0 ? "left-1/2 bg-red-500/80" : "right-1/2 bg-emerald-500/80")}
                    style={{ width: `${w}%` }} />
                </span>
                <span className={cn("text-right text-xs font-medium tabular-nums", c.points >= 0 ? "text-red-600" : "text-emerald-700")}>
                  {signed(c.points)}
                </span>
              </button>
            )
          })}
        </div>
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show top 6" : `Show all ${ex.contributions.length} factors`}
        </Button>
      </CardContent>
    </Card>
  )
}
