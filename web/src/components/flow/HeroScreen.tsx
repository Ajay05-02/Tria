// Landing page: the message and one call to action beside the live 3D heart. It carries no patient data:
// the arteries are named but stay neutral until someone has answered the questions
import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { labelNames } from "@/lib/format"
import { createHeartViewer } from "@/lib/heart.js"
import type { Meta } from "@/lib/types"

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

interface Props { meta: Meta | null; onStart: () => void }

export function HeroScreen({ meta, onStart }: Props) {
  const n = meta?.key_inputs.length ?? 11
  const ev = meta?.evaluation?.v2_calibrated_with_threshold.Cath
  const facts = [
    { value: ev ? ev.auc.toFixed(2) : "0.93", label: "ROC-AUC for coronary artery disease" },
    { value: ev ? `${Math.round(ev.sensitivity * 100)}%` : "91%", label: "of patients with the disease caught at the cut-off" },
    { value: meta?.external_validation ? meta.external_validation.n_patients.toLocaleString("en") : "1,223", label: "patients from 5 hospitals in the external check" },
  ]
  const stageRef = useRef<HTMLDivElement | null>(null)

  // The same Three.js heart as the results page; the wheel is left to the page so the landing still scrolls
  useEffect(() => {
    let picked: string | null = null
    const viewer = createHeartViewer(stageRef.current!, {
      reduceMotion, zoom: false,
      onSelect: (v) => { picked = v === picked ? null : v; viewer.select(picked) },
    })
    viewer.setLabelNames(labelNames(false))
    viewer.setBeating(!reduceMotion)
    viewer.setTerritories(false)
    return () => viewer.dispose()
  }, [])

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
            Answer {n} questions. Tria estimates the chance of coronary artery disease and shows which artery is most at risk.
          </motion.p>
          <motion.div {...rise(0.25)} className="mt-8">
            <Button size="lg" onClick={onStart} disabled={!meta} className="h-11 rounded-lg px-6 text-[0.95rem] font-semibold">
              Start the assessment <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
          </motion.div>
        </div>

        <motion.div {...rise(0.2)} className="overflow-hidden rounded-2xl border bg-card">
          <div ref={stageRef} className="heart-stage relative aspect-[4/3] w-full" role="img"
            aria-label="Interactive 3D heart with the three main coronary arteries labelled: LAD, LCX and RCA. Drag to rotate, click an artery." />
        </motion.div>
      </section>

      <section className="border-t bg-card" aria-label="How well it works">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10 lg:px-8">
          <p className="max-w-[15rem] text-sm font-medium text-foreground">Checked against real angiograms</p>
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3">
                <dt className="sr-only">{f.label}</dt>
                <dd className="text-right text-2xl font-semibold tracking-tight tabular-nums">{f.value}</dd>
                <dd className="text-sm leading-snug text-muted-foreground">{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </motion.div>
  )
}
