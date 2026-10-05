import { useEffect, useRef, type RefObject } from "react"
import { FileDown, HeartPulse, Layers, PersonStanding, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { createHeartViewer, type HeartViewer, type VesselRisk } from "@/lib/heart.js"
import { labelNames } from "@/lib/format"
import type { Vessel } from "@/lib/types"

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

export type ViewOption = "torso" | "riskmap" | "beat"

interface Props {
  viewerRef: RefObject<HeartViewer | null>
  stageRef: RefObject<HTMLDivElement | null>
  risks: Record<Vessel, VesselRisk> | null
  selected: Vessel | null
  plain: boolean
  bpm: number
  view: ViewOption[]
  caption: string
  mode: "risk" | "cond"
  busy: boolean
  onView: (v: ViewOption[]) => void
  onSelect: (v: Vessel | null) => void
  onPdf: () => void
}

export function HeartView({ viewerRef, stageRef, risks, selected, plain, bpm, view, caption, mode, busy, onView, onSelect, onPdf }: Props) {
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // The Three.js scene is created once and removed when the component unmounts
  useEffect(() => {
    const viewer = createHeartViewer(stageRef.current!, {
      onSelect: (v) => onSelectRef.current(v as Vessel | null),
      reduceMotion,
    })
    viewerRef.current = viewer
    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
  }, [viewerRef, stageRef])

  useEffect(() => { if (risks) viewerRef.current?.setRisks(risks) }, [risks, viewerRef])
  useEffect(() => { viewerRef.current?.select(selected) }, [selected, viewerRef])
  useEffect(() => { viewerRef.current?.setLabelNames(labelNames(plain)) }, [plain, viewerRef])
  useEffect(() => { viewerRef.current?.setHeartRate(bpm) }, [bpm, viewerRef])
  useEffect(() => {
    const v = viewerRef.current
    v?.setTorso(view.includes("torso"))
    v?.setTerritories(view.includes("riskmap"))
    v?.setBeating(view.includes("beat"))
  }, [view, viewerRef])

  return (
    <Card className="relative flex h-full min-h-[420px] flex-col gap-0 overflow-hidden p-0">
      <p className="absolute top-3 left-4 z-10 max-w-[70%] text-sm text-muted-foreground">{caption}</p>
      <div
        ref={stageRef}
        className="heart-stage relative min-h-0 flex-1"
        role="img"
        aria-label="Interactive 3D heart. Each coronary artery is coloured by its predicted risk. Drag to rotate, scroll to zoom, click an artery."
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
        <div className="w-44" aria-hidden="true">
          <div className="risk-ramp relative h-1.5 rounded-full">
            <span className="absolute top-1/2 left-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Lower</span><span>{mode === "cond" ? "Average" : "Cut-off"}</span><span>Higher</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="multiple" variant="outline" size="sm" value={view} onValueChange={(v) => onView(v as ViewOption[])} aria-label="View options">
            <ToggleGroupItem value="torso" aria-label="Show torso"><PersonStanding /><span className="hidden sm:inline">Torso</span></ToggleGroupItem>
            <ToggleGroupItem value="riskmap" aria-label="Colour the heart muscle by risk"><Layers /><span className="hidden sm:inline">Risk map</span></ToggleGroupItem>
            <ToggleGroupItem value="beat" aria-label="Heartbeat"><HeartPulse /><span className="hidden sm:inline">Beat</span></ToggleGroupItem>
          </ToggleGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={() => viewerRef.current?.resetView()} aria-label="Reset view"><RotateCcw /></Button>
            </TooltipTrigger>
            <TooltipContent>Reset view</TooltipContent>
          </Tooltip>
          <Button size="sm" onClick={onPdf} disabled={busy}><FileDown /> {busy ? "Preparing" : "Save PDF"}</Button>
        </div>
      </div>
    </Card>
  )
}
