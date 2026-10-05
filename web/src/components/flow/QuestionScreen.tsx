// One question per screen, after Kard's AssessmentScreen (github.com/7-Bala/Kard, MIT)
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"

import { Stepper } from "@/components/kard/Stepper"
import {
  IllusAge, IllusBloodSugar, IllusBP, IllusChestPain, IllusCholesterol, IllusSex, IllusSmoking,
  IllusEjection, IllusSTDepression, IllusThalassemia, IllusWallMotion,
} from "@/components/kard/Svgs"
import { cn } from "@/lib/utils"
import { chosenOption, type Illustration, type Question } from "@/lib/questions"
import type { Field, Inputs } from "@/lib/types"

const ILLUS: Record<Illustration, (p: { className?: string }) => React.ReactNode> = {
  age: IllusAge, sex: IllusSex, chestPain: IllusChestPain, bloodSugar: IllusBloodSugar, bp: IllusBP,
  cholesterol: IllusCholesterol, smoking: IllusSmoking, ecg: IllusSTDepression, wallMotion: IllusWallMotion,
  pump: IllusEjection, bloodTest: IllusThalassemia,
}

interface Props {
  question: Question
  index: number
  total: number
  direction: 1 | -1
  inputs: Inputs
  entered: boolean
  field?: Field
  onAnswer: (values: Inputs) => void
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onUpdate?: () => void   // shown when editing an answer from the results
}

export function QuestionScreen({ question: q, index, total, direction, inputs, entered, field, onAnswer, onNext, onPrev, onSkip, onUpdate }: Props) {
  const Illus = ILLUS[q.illus]
  const [showError, setShowError] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [num, setNum] = useState<number | "">(q.kind === "number" ? inputs[q.key] : "")
  useEffect(() => () => { if (errTimer.current) clearTimeout(errTimer.current) }, [])

  const chosen = q.kind === "choice" && entered ? chosenOption(q, inputs) : -1
  const onKeys = q.kind === "multi" ? q.options.filter((o) => inputs[o.key] === 1).map((o) => o.key) : []
  const noneChosen = q.kind === "multi" && entered && onKeys.length === 0
  const answered = q.kind === "number" ? num !== "" : q.kind === "choice" ? chosen >= 0 : entered || onKeys.length > 0
  const last = index === total - 1

  const next = () => {
    if (advancing) return
    if (!answered) {
      setShowError(true)
      if (errTimer.current) clearTimeout(errTimer.current)
      errTimer.current = setTimeout(() => setShowError(false), 3000)
      return
    }
    if (q.kind === "number" && num !== "") onAnswer({ [q.key]: num })
    if (q.kind === "multi") onAnswer(Object.fromEntries(q.options.map((o) => [o.key, onKeys.includes(o.key) ? 1 : 0])))
    onNext()
  }

  const twoCols = q.kind === "choice" && q.options.length === 2
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 64 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
  }

  return (
    <motion.div custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-8">
      <span aria-hidden="true" className="mb-2 block font-serif leading-none font-bold text-primary/30 tabular-nums select-none"
        style={{ fontSize: "clamp(40px, 8vw, 56px)" }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <h2 id={`q-title-${index}`} className="mb-2 font-serif text-[1.9rem] leading-[1.15] text-balance text-foreground md:text-4xl">{q.title}</h2>
      <p className="mb-7 text-sm leading-relaxed text-muted-foreground">{q.desc}</p>

      <div className="relative mx-auto mb-7 flex-shrink-0" style={{ width: 172, height: 172 }} aria-hidden="true">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-dashed border-border/55" />
        <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-background px-2 text-[9px] font-bold tracking-[0.15em] whitespace-nowrap text-muted-foreground/40 uppercase">
          Diagnostic
        </span>
        <div className="h-full w-full p-3.5"><Illus className="h-full w-full" /></div>
      </div>

      <div aria-labelledby={`q-title-${index}`} role="group" className="relative z-10">
        {q.kind === "number" && (
          <Stepper value={num} onChange={(v) => setNum(v)} min={field?.min ?? 0} max={field?.max ?? 100} step={field?.step ?? 1} unit={q.unit} />
        )}

        {q.kind === "choice" && (
          <div className={cn("grid gap-2.5", twoCols ? "grid-cols-2" : "grid-cols-1")} role="listbox" aria-label={q.title}>
            {q.options.map((o, i) => (
              <OptionCard key={o.label} label={o.label} desc={o.desc} selected={chosen === i} role="option"
                onClick={() => {
                  if (advancing) return
                  onAnswer(o.values)
                  setAdvancing(true)
                  setTimeout(onNext, 400)       // Kard's auto-advance after a choice
                }} />
            ))}
          </div>
        )}

        {q.kind === "multi" && (
          <div className="grid grid-cols-1 gap-2.5" role="group" aria-label={q.title}>
            <OptionCard label="None of these" selected={noneChosen} role="checkbox"
              onClick={() => onAnswer(Object.fromEntries(q.options.map((o) => [o.key, 0])))} />
            {q.options.map((o) => (
              <OptionCard key={o.key} label={o.label} desc={o.desc} selected={onKeys.includes(o.key)} role="checkbox"
                onClick={() => onAnswer({ [o.key]: onKeys.includes(o.key) ? 0 : 1 })} />
            ))}
          </div>
        )}
      </div>

      {onUpdate && (
        <button onClick={() => { if (q.kind === "number" && num !== "") onAnswer({ [q.key]: num }); onUpdate() }}
          className="mt-6 self-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none">
          Update my results
        </button>
      )}

      <button onClick={onSkip}
        className="mt-5 self-center rounded text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
        Not sure? Use a typical value
      </button>

      <div className="relative z-0 mt-6 w-full px-2">
        <div className="relative flex min-h-[40px] w-full items-center justify-between">
          <button onClick={onPrev} disabled={index === 0}
            className="group z-10 flex items-center rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0">
            <ArrowLeft className="mr-1.5 size-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" /> Previous
          </button>
          <div className="flex items-center justify-center">
            <AnimatePresence>
              {showError && (
                <motion.div initial={{ opacity: 0, y: -40 }}
                  animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 12, mass: 1.2 } }}
                  exit={{ opacity: 0, y: -40, transition: { type: "tween", ease: "anticipate", duration: 0.35 } }}
                  className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-md">
                  <AlertCircle className="size-4" /> Please choose an answer
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={next}
            className="group z-10 flex items-center rounded text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            {last ? "Finish" : "Next"} <ArrowRight className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Kard's answer card: rose border and a check mark when chosen
function OptionCard({ label, desc, selected, role, onClick }: { label: string; desc?: string; selected: boolean; role: "option" | "checkbox"; onClick: () => void }) {
  return (
    <button type="button" role={role} aria-selected={role === "option" ? selected : undefined} aria-checked={role === "checkbox" ? selected : undefined}
      onClick={onClick}
      className={cn("relative flex min-h-[52px] items-center rounded-2xl border p-4 text-left text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        selected ? "border-primary bg-primary/[0.07] text-primary" : "border-border bg-card text-foreground hover:border-primary/35 hover:bg-secondary/50")}>
      {selected && (
        <span aria-hidden="true" className="absolute top-1/2 right-3.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-primary">
          <svg viewBox="0 0 10 8" className="size-2.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 3.5,6.5 9,1" />
          </svg>
        </span>
      )}
      <span className="flex flex-col">
        <span className={selected ? "pr-7" : ""}>{label}</span>
        {desc && <span className="mt-1 text-xs font-normal text-muted-foreground">{desc}</span>}
      </span>
    </button>
  )
}
