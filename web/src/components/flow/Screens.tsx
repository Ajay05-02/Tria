// The smaller screens of the flow, after Kard (github.com/7-Bala/Kard, MIT): optional details, analyzing,
// insights (model accuracy) and the About / Privacy / Terms pages
import { motion } from "framer-motion"
import { ArrowRight, ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IllusECG } from "@/components/kard/Svgs"
import { ModelTab } from "@/components/ModelTab"
import { OptionalInputs } from "@/components/OptionalInputs"
import type { Inputs, Meta } from "@/lib/types"

const BackLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className="flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
    <ChevronLeft className="size-4" aria-hidden="true" /> {children}
  </button>
)

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
        <span className="mb-2 block text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Optional</span>
        <h2 className="mb-2 font-serif text-[1.9rem] leading-[1.15] text-foreground md:text-4xl">Any other test results?</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The {meta.key_inputs.length} questions already give almost the full accuracy. If you have other results (blood tests,
          vital signs, more ECG or echo findings), add them here; anything you leave stays at a typical value.
        </p>
      </div>
      <OptionalInputs meta={meta} inputs={inputs} touched={touched} fromBlank={fromBlank} focus={focus} onChange={onChange} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onDone} className="h-12 rounded-full sm:flex-1 bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
          See my results <ArrowRight className="ml-1 size-4" aria-hidden="true" />
        </Button>
      </div>
    </motion.div>
  )
}

export function AnalyzingScreen() {
  return (
    <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-10 px-6" role="status" aria-live="polite" aria-label="Analyzing the heart…">
      <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="w-full max-w-sm rounded-2xl border border-dashed border-border/60 bg-card/40 p-6">
        <IllusECG />
      </motion.div>
      <div className="text-center">
        <h2 className="mb-5 font-serif text-4xl text-foreground italic">Analyzing the heart…</h2>
        <div className="flex justify-center gap-2.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ scale: [0.6, 1, 0.6], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
              className="inline-block size-2.5 rounded-full bg-primary" />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function InsightsScreen({ meta, onBack, backLabel }: { meta: Meta; onBack: () => void; backLabel: string }) {
  return (
    <motion.div key="insights" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3, ease: "easeOut" }} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
      <BackLink onClick={onBack}>{backLabel}</BackLink>
      <div className="max-w-2xl">
        <h2 className="mb-3 font-serif text-4xl font-bold text-balance text-foreground">How accurate is flowstate?</h2>
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
    title: "About flowstate",
    body: [
      "flowstate estimates the chance of coronary artery disease (50% or more narrowing of a heart artery) and of narrowing in each of the three main arteries, the LAD, LCX and RCA, from routine clinical data. It shows the result on an anatomical 3D heart and explains which answers raised or lowered it.",
      "It was built for the Multimodal AI Hackathon 2026 (Track A) on the Z-Alizadeh Sani extension dataset (UCI #411, CC BY 4.0). The 3D heart comes from the HuBMAP Human Reference Atlas (female heart v1.0 by Kristen Browne, CC BY 4.0). The interface follows the open-source Kard design by 7-Bala (MIT).",
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "flowstate has no accounts and does not store what you enter. Your answers are sent to the prediction server only to compute the result on the screen, and are not saved or logged with the result.",
      "The PDF report is created in your browser and saved straight to your device.",
    ],
  },
  terms: {
    title: "Terms of use",
    body: [
      "flowstate is an educational prototype. It is not a medical device and not a substitute for coronary angiography, for medical advice, diagnosis or treatment.",
      "The model learned from 303 patients at one hospital who were all referred for angiography, so its percentages apply to similar high-risk patients. Always ask a qualified health professional about any question on a medical condition.",
    ],
  },
}

export function LegalScreen({ type, onBack }: { type: LegalType; onBack: () => void }) {
  const c = LEGAL[type]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <div className="mb-8"><BackLink onClick={onBack}>Back</BackLink></div>
      <h1 className="mb-6 font-serif text-4xl font-semibold text-foreground">{c.title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
        {c.body.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
      </div>
    </motion.div>
  )
}
