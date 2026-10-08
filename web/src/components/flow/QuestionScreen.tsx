// One question per screen, after Kard's AssessmentScreen (github.com/7-Bala/Kard, MIT)
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useIsPresent } from "framer-motion"
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"

import { Stepper } from "@/components/kard/Stepper"
import {
  IllusAge, IllusBloodTest, IllusBP, IllusChestPain, IllusCholesterol, IllusDiabetes, IllusECG, IllusPump, IllusSex,
  IllusSmoking, IllusWallMotion,
} from "@/components/flow/Illustrations"
import { cn } from "@/lib/utils"
import { chosenOption, type Illustration, type Question } from "@/lib/questions"
import type { Field, Inputs } from "@/lib/types"

const ILLUS: Record<Illustration, (p: { className?: string; value?: number | "" }) => React.ReactNode> = {
  age: IllusAge, sex: IllusSex, chestPain: IllusChestPain, bloodSugar: IllusDiabetes, bp: IllusBP,
  cholesterol: IllusCholesterol, smoking: IllusSmoking, ecg: IllusECG, wallMotion: IllusWallMotion,
  pump: IllusPump, bloodTest: IllusBloodTest,
}

interface Props {
  question: Question
  index: number
  total: number
  direction: 1 | -1
  inputs: Inputs
  entered: boolean
  isNotSure?: boolean
  field?: Field
  hasPrev?: boolean       // the first question can go back to the name screen
  onAnswer: (values: Inputs) => void
  onNotSure?: (values: Inputs) => void
  onNext: () => void
  onPrev: () => void
  onUpdate?: () => void   // shown when editing an answer from the results
}

export function QuestionScreen({
  question: q,
  index,
  total,
  direction,
  inputs,
  entered,
  isNotSure = false,
  field,
  hasPrev = index > 0,
  onAnswer,
  onNotSure,
  onNext,
  onPrev,
  onUpdate,
}: Props) {
  const Illus = ILLUS[q.illus]
  const [showError, setShowError] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [num, setNum] = useState<number | "">(q.kind === "number" ? inputs[q.key] : "")
  // Auto-advance after a choice, unless the question has been left meanwhile (for example with the progress dots).
  // A question that is fading out is still mounted, so being mounted is not enough: it has to be the present one.
  const advTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const present = useRef(true)
  present.current = useIsPresent()
  const advance = () => { advTimer.current = setTimeout(() => { if (present.current) onNext() }, 400) }
  useEffect(() => () => {
    if (errTimer.current) clearTimeout(errTimer.current)
    if (advTimer.current) clearTimeout(advTimer.current)
  }, [])

  const chosen = q.kind === "choice" && entered && !isNotSure ? chosenOption(q, inputs) : -1
  const onKeys = q.kind === "multi" && !isNotSure ? q.options.filter((o) => inputs[o.key] === 1).map((o) => o.key) : []
  const noneChosen = q.kind === "multi" && entered && !isNotSure && onKeys.length === 0
  const answered = isNotSure || (q.kind === "number" ? num !== "" : q.kind === "choice" ? chosen >= 0 : entered || onKeys.length > 0)
  const last = index === total - 1

  const next = () => {
    if (advancing) return
    if (!answered) {
      setShowError(true)
      if (errTimer.current) clearTimeout(errTimer.current)
      errTimer.current = setTimeout(() => setShowError(false), 3000)
      return
    }
    if (!isNotSure && q.kind === "number" && num !== "") onAnswer({ [q.key]: num })
    if (!isNotSure && q.kind === "multi") onAnswer(Object.fromEntries(q.options.map((o) => [o.key, onKeys.includes(o.key) ? 1 : 0])))
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
      className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-8 px-5 py-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8 lg:py-12">
      {/* the question and its picture */}
      <div className="flex flex-col">
        <h2 id={`q-title-${index}`} className="text-3xl leading-tight font-semibold tracking-tight text-foreground md:text-4xl">{q.title}</h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{q.desc}</p>
        <div className="mt-6 w-full max-w-[300px] shrink-0 self-start lg:mt-10 lg:max-w-[400px]">
          <Illus className="h-auto w-full" value={q.kind === "number" ? num : undefined} />
        </div>
      </div>

      {/* the answers */}
      <div className="flex flex-col justify-center">
        <div aria-labelledby={`q-title-${index}`} role="group" className="relative z-10 w-full max-w-md">
          {q.kind === "number" && (
            <div className="flex flex-col items-start gap-4">
              <Stepper
                value={num}
                onChange={(v) => {
                  setNum(v)
                  if (v !== "") onAnswer({ [q.key]: v })
                }}
                min={field?.min ?? 0}
                max={field?.max ?? 100}
                step={field?.step ?? 1}
                unit={q.unit}
              />
              {q.allowNotSure && (
                <button
                  type="button"
                  onClick={() => {
                    if (advancing) return
                    const typical = q.typicalValue ?? field?.median ?? 0
                    setNum(typical)
                    onNotSure?.({ [q.key]: typical })
                    setAdvancing(true)
                    advance()
                  }}
                  className={cn(
                    "relative flex min-h-[52px] w-full max-w-xs items-center justify-between rounded-xl border p-4 text-left text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    isNotSure
                      ? "border-primary bg-primary/[0.07] text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/35 hover:bg-secondary/50"
                  )}
                >
                  <span className="flex flex-col">
                    <span>Not sure</span>
                    <span className="mt-0.5 text-xs font-normal text-muted-foreground">
                      Use typical value ({q.typicalValue ?? field?.median ?? 0} {q.unit})
                    </span>
                  </span>
                  {isNotSure ? (
                    <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-primary">
                      <svg viewBox="0 0 10 8" className="size-2.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1,4 3.5,6.5 9,1" />
                      </svg>
                    </span>
                  ) : (
                    <span className="rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                      Typical
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {q.kind === "choice" && (
            <div className="flex flex-col gap-2.5">
              <div className={cn("grid gap-2.5", twoCols ? "grid-cols-2" : "grid-cols-1")} role="listbox" aria-label={q.title}>
                {q.options.map((o, i) => (
                  <OptionCard key={o.label} label={o.label} desc={o.desc} selected={!isNotSure && chosen === i} role="option"
                    onClick={() => {
                      if (advancing) return
                      onAnswer(o.values)
                      setAdvancing(true)
                      advance()       // Kard's auto-advance after a choice
                    }} />
                ))}
              </div>
              {q.allowNotSure && (
                <OptionCard
                  label="Not sure"
                  desc={q.notSureDesc ?? "Use typical value"}
                  selected={isNotSure}
                  role="option"
                  onClick={() => {
                    if (advancing) return
                    onNotSure?.(q.notSureValues ?? {})
                    setAdvancing(true)
                    advance()
                  }}
                />
              )}
            </div>
          )}

          {q.kind === "multi" && (
            <div className="grid grid-cols-1 gap-2.5" role="group" aria-label={q.title}>
              <OptionCard label="None of these" selected={!isNotSure && noneChosen} role="checkbox"
                onClick={() => onAnswer(Object.fromEntries(q.options.map((o) => [o.key, 0])))} />
              {q.options.map((o) => (
                <OptionCard key={o.key} label={o.label} desc={o.desc} selected={!isNotSure && onKeys.includes(o.key)} role="checkbox"
                  onClick={() => onAnswer({ [o.key]: onKeys.includes(o.key) ? 0 : 1 })} />
              ))}
              {q.allowNotSure && (
                <OptionCard
                  label="Not sure / No ECG done"
                  desc={q.notSureDesc ?? "Use typical value (assume normal)"}
                  selected={isNotSure}
                  role="checkbox"
                  onClick={() => {
                    if (advancing) return
                    onNotSure?.(q.notSureValues ?? Object.fromEntries(q.options.map((o) => [o.key, 0])))
                    setAdvancing(true)
                    advance()
                  }}
                />
              )}
            </div>
          )}
        </div>

        {onUpdate && (
          <button onClick={() => {
            if (!isNotSure && q.kind === "number" && num !== "") onAnswer({ [q.key]: num })
            onUpdate()
          }}
            className="mt-6 self-start rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none">
            Update my results
          </button>
        )}

        <div className="relative z-0 mt-8 w-full border-t pt-4">
          <div className="relative flex min-h-[40px] w-full items-center justify-between">
            <button onClick={onPrev} disabled={!hasPrev}
              className="group z-10 flex items-center rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0">
              <ArrowLeft className="mr-1.5 size-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" /> Previous
            </button>
            <div className="flex items-center justify-center">
              <AnimatePresence>
                {showError && (
                  <motion.div initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 12, mass: 1.2 } }}
                    exit={{ opacity: 0, y: -40, transition: { type: "tween", ease: "anticipate", duration: 0.35 } }}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-md">
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
      </div>
    </motion.div>
  )
}

// Kard's answer card: rose border and a check mark when chosen
function OptionCard({ label, desc, selected, role, onClick }: { label: string; desc?: string; selected: boolean; role: "option" | "checkbox"; onClick: () => void }) {
  return (
    <button type="button" role={role} aria-selected={role === "option" ? selected : undefined} aria-checked={role === "checkbox" ? selected : undefined}
      onClick={onClick}
      className={cn("relative flex min-h-[52px] items-center rounded-xl border p-4 text-left text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
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
