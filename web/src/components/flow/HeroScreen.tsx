// Landing page: the message and one call to action beside a real render of flowstate's 3D heart
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Meta } from "@/lib/types"

interface Props { meta: Meta | null; onStart: () => void; onExample: (index: number) => void }

export function HeroScreen({ meta, onStart, onExample }: Props) {
  const n = meta?.key_inputs.length ?? 11
  const ev = meta?.evaluation?.v2_calibrated_with_threshold.Cath
  const facts = [
    { value: ev ? ev.auc.toFixed(2) : "0.93", label: "ROC-AUC for coronary artery disease" },
    { value: ev ? `${Math.round(ev.sensitivity * 100)}%` : "91%", label: "of patients with the disease caught at the cut-off" },
    { value: meta?.external_validation ? meta.external_validation.n_patients.toLocaleString("en") : "1,223", label: "patients from 5 hospitals in the external check" },
  ]
  const rise = (delay: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } })

  return (
    <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:px-8 lg:py-14">
        <div className="flex flex-col items-start">
          <motion.h1 {...rise(0.05)} className="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-foreground [text-wrap:wrap] md:text-5xl lg:text-[2.8rem]">
            Coronary risk, mapped onto the heart.
          </motion.h1>
          <motion.p {...rise(0.15)} className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Answer {n} questions. flowstate estimates the chance of coronary artery disease and shows which artery is most at risk.
          </motion.p>
          <motion.div {...rise(0.25)} className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart} disabled={!meta} className="h-11 rounded-lg px-6 text-[0.95rem] font-semibold">
              Start the assessment <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
            {meta && (
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
            )}
          </motion.div>
        </div>

        <motion.figure {...rise(0.2)} className="overflow-hidden rounded-2xl border bg-card">
          <img src="hero-heart.jpg" width={1200} height={900} className="h-auto w-full"
            alt="flowstate's 3D heart for an example patient: the LAD artery is red at 94% risk, the RCA amber at 37% and the LCX green at 17%." />
          <figcaption className="border-t px-5 py-3 text-sm text-muted-foreground">
            An example patient from the study: the front artery (LAD) is the most likely to be narrowed.
          </figcaption>
        </motion.figure>
      </section>

      <section className="border-t bg-card" aria-label="How well it works">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 sm:grid-cols-[auto_1fr] sm:items-center lg:px-8">
          <p className="max-w-[15rem] text-sm font-medium text-foreground">Tested on patients the model never saw</p>
          <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-2.5">
                <dt className="sr-only">{f.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">{f.value}</dd>
                <dd className="text-sm leading-snug text-muted-foreground">{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </motion.div>
  )
}
