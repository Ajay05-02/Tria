// The smaller screens of the flow, after Kard (github.com/7-Bala/Kard, MIT): optional details, analyzing,
// insights (model accuracy) and the About / Privacy / Terms pages
import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModelTab } from "@/components/ModelTab"
import { OptionalInputs } from "@/components/OptionalInputs"
import type { Inputs, Meta } from "@/lib/types"
import { WORDMARK } from "@/lib/wordmark"

const BackLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className="flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
    <ChevronLeft className="size-4" aria-hidden="true" /> {children}
  </button>
)

const NOT_NAME = /[^\p{L}\p{M} .'’-]/gu

// Before the questions: the patient's name, required, to label the results and the report. It stays in the browser;
// only the answers are scored.
export function NameScreen({ name, onChange, onBack, onNext }: { name: string; onChange: (v: string) => void; onBack: () => void; onNext: () => void }) {
  const [problem, setProblem] = useState<"" | "missing" | "letters">("")
  const nav = "group flex items-center rounded text-sm font-medium text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
  return (
    <motion.div key="name" initial={{ opacity: 0, x: 64 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
      className="mx-auto grid w-full max-w-5xl flex-1 content-center gap-8 px-5 py-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8 lg:py-12">
      <div className="flex flex-col">
        <h2 id="name-title" className="text-3xl leading-tight font-semibold tracking-tight text-foreground md:text-4xl">What is the patient's name?</h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          It labels the results and the PDF report. The name stays in this browser and is never sent to the server.
        </p>
      </div>
      <form className="flex flex-col justify-center" noValidate onSubmit={(e) => {
        e.preventDefault()
        if (!/\p{L}/u.test(name)) { setProblem("missing"); return }
        onChange(name.trim().replace(/\s+/g, " "))
        onNext()
      }}>
        <Input autoFocus required value={name} onChange={(e) => {
          // a name is letters, with spaces, hyphens, apostrophes and full stops between them: no digits or symbols
          const clean = e.target.value.replace(NOT_NAME, "").replace(/^\s+/, "")
          onChange(clean)
          setProblem(clean === e.target.value ? "" : "letters")
        }} maxLength={60} autoComplete="off" spellCheck={false}
          aria-labelledby="name-title" aria-invalid={problem !== ""} aria-describedby={problem ? "name-error" : undefined}
          placeholder="Full name" className="h-12 max-w-md rounded-xl bg-card px-4 text-base md:text-base" />
        {problem && (
          <p id="name-error" role="alert" className="mt-2 text-sm font-medium text-destructive">
            {problem === "missing" ? "Enter the patient's name to continue." : "A name can only contain letters."}
          </p>
        )}
        <div className="mt-8 flex min-h-[40px] w-full items-center justify-between border-t pt-4">
          <button type="button" onClick={onBack} className={`${nav} hover:text-foreground`}>
            <ArrowLeft className="mr-1.5 size-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" /> Back
          </button>
          <button type="submit" className={`${nav} hover:text-primary`}>
            Next <ArrowRight className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// After the 11 questions: everything else, optional and kept simple
export function DetailsScreen({ meta, inputs, touched, fromBlank, focus, onChange, onBack, onDone }: {
  meta: Meta; inputs: Inputs; touched: Set<string>; fromBlank: boolean; focus: { id: string; n: number } | null
  onChange: (id: string, v: Inputs) => void; onBack: () => void; onDone: () => void
}) {
  return (
    <motion.div key="details" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <BackLink onClick={onBack}>Back to the questions</BackLink>
      <div>
        <h2 className="mb-2 text-3xl font-semibold tracking-tight text-foreground">Any other test results? <span className="text-muted-foreground">(optional)</span></h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The {meta.key_inputs.length} questions already give almost the full accuracy. If you have other results (blood tests,
          vital signs, more ECG or echo findings), add them here; anything you leave stays at a typical value.
        </p>
      </div>
      <OptionalInputs meta={meta} inputs={inputs} touched={touched} fromBlank={fromBlank} focus={focus} onChange={onChange} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onDone} className="h-11 self-start rounded-lg px-6 font-semibold">
          See my results <ArrowRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
      </div>
    </motion.div>
  )
}

// While the answers are scored: the wordmark writes itself once, then a hairline keeps time until the result
// arrives. The wait is short, so there is nothing here to read except what is happening.
export function AnalyzingScreen() {
  return (
    <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="flex flex-1 flex-col items-center justify-center gap-7 px-6" role="status" aria-live="polite" aria-label="Working out the result">
      <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} className="loader-mark h-16 w-auto text-foreground" fill="none" stroke="currentColor"
        strokeWidth={WORDMARK.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {WORDMARK.paths.map((d, i) => <path key={d} d={d} pathLength={1} style={{ animationDelay: `${i * 0.11}s` }} />)}
      </svg>
      <div className="loader-line h-0.5 w-44 overflow-hidden rounded-full bg-border" aria-hidden="true"><span /></div>
      <p className="text-sm text-muted-foreground">Working out the result</p>
    </motion.div>
  )
}

export function InsightsScreen({ meta, onBack, backLabel }: { meta: Meta; onBack: () => void; backLabel: string }) {
  return (
    <motion.div key="insights" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3, ease: "easeOut" }} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
      <BackLink onClick={onBack}>{backLabel}</BackLink>
      <div className="max-w-2xl">
        <h2 className="mb-3 text-3xl font-semibold tracking-tight text-foreground">How accurate is Tria?</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every number below comes from patients the model never saw while learning. It was trained on {meta.n_patients} patients from
          the Z-Alizadeh Sani study, whose arteries were checked by coronary angiography.
        </p>
      </div>
      <ModelTab meta={meta} />
    </motion.div>
  )
}

export type LegalType = "about" | "privacy" | "terms"
const LEGAL: Record<LegalType, { title: string; body: string[] }> = {
  about: {
    title: "About Tria",
    body: [
      "Tria estimates the chance of coronary artery disease (50% or more narrowing of a heart artery) and of narrowing in each of the three main arteries, the LAD, LCX and RCA, from routine clinical data. It shows the result on an anatomical 3D heart and explains which answers raised or lowered it.",
      "It was built for the Multimodal AI Hackathon 2026 (Track A) on the Z-Alizadeh Sani extension dataset (UCI #411, CC BY 4.0). The 3D heart comes from the HuBMAP Human Reference Atlas (female heart v1.0 by Kristen Browne, CC BY 4.0). The interface follows the open-source Kard design by 7-Bala (MIT).",
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "Tria has no accounts and does not store what you enter. Your answers are sent to the prediction server only to compute the result on the screen, and are not saved or logged with the result.",
      "The patient's name never leaves your browser. It is used only to label the results and the PDF report, and it is gone when you close or reload the page.",
      "The PDF report is created in your browser and saved straight to your device.",
    ],
  },
  terms: {
    title: "Terms of use",
    body: [
      "Tria is an educational prototype. It is not a medical device and not a substitute for coronary angiography, for medical advice, diagnosis or treatment.",
      "The model learned from 303 patients at one hospital who were all referred for angiography, so its percentages apply to similar high-risk patients. Always ask a qualified health professional about any question on a medical condition.",
    ],
  },
}

export function LegalScreen({ type, meta, onExample, onBack }: { type: LegalType; meta: Meta | null; onExample: (index: number) => void; onBack: () => void }) {
  const c = LEGAL[type]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <div className="mb-8"><BackLink onClick={onBack}>Back</BackLink></div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-foreground">{c.title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
        {c.body.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
      </div>
      {type === "about" && meta && (
        <section className="mt-10 border-t pt-8" aria-labelledby="examples-heading">
          <h2 id="examples-heading" className="mb-2 text-xl font-semibold tracking-tight text-foreground">Try a patient from the study</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            Open one of the {meta.patients.length} study patients to see their results on the 3D heart, with the prediction from a model that never saw them.
          </p>
          <Select onValueChange={(v) => onExample(Number(v))}>
            <SelectTrigger className="h-11 rounded-lg bg-card px-4 text-[0.95rem]" aria-label="Open a patient from the study">
              <SelectValue placeholder="Open a study patient" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectGroup>
                <SelectLabel>Patients from the study</SelectLabel>
                {meta.patients.map((p) => (
                  <SelectItem key={p.index} value={String(p.index)}>Example {p.index + 1}: {p.age}-year-old {p.sex === 1 ? "man" : "woman"}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </section>
      )}
    </motion.div>
  )
}
