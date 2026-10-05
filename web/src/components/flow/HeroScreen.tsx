// Landing page, after Kard (github.com/7-Bala/Kard, MIT), with flowstate's own message and numbers
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EkgWave } from "@/components/kard/Svgs"
import type { Meta } from "@/lib/types"

interface Props { meta: Meta | null; onStart: () => void; onExample: (index: number) => void }

export function HeroScreen({ meta, onStart, onExample }: Props) {
  const n = meta?.key_inputs.length ?? 11
  const ev = meta?.evaluation?.v2_calibrated_with_threshold.Cath
  const stats = [
    { value: ev ? ev.auc.toFixed(2) : "0.93", label: "ROC-AUC for coronary artery disease, tested on patients the model never saw" },
    { value: ev ? `${Math.round(ev.sensitivity * 100)}%` : "91%", label: "Of patients with coronary artery disease flagged at the cut-off" },
    { value: meta?.external_validation ? meta.external_validation.n_patients.toLocaleString("en") : "1,223", label: "Patients in 5 hospitals used to check that the approach travels" },
  ]

  return (
    <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45 }}
      className="relative flex flex-1 flex-col overflow-hidden">
      {/* ambient blobs and rising dots */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <motion.div animate={{ x: [0, 38, -8, 0], y: [0, -28, 18, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -right-20 h-[500px] w-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(225,29,72,0.07) 0%, transparent 68%)" }} />
        <motion.div animate={{ x: [0, -28, 16, 0], y: [0, 38, -18, 0] }} transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute top-1/2 -left-36 h-[440px] w-[440px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,124,102,0.06) 0%, transparent 68%)" }} />
        <motion.div animate={{ x: [0, 18, -10, 0], y: [0, -18, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 8 }}
          className="absolute right-1/4 -bottom-10 h-[360px] w-[360px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(225,29,72,0.05) 0%, transparent 65%)" }} />
        {[{ x: "18%", delay: 0, dur: 9 }, { x: "42%", delay: 2.2, dur: 12 }, { x: "68%", delay: 5, dur: 10 }, { x: "82%", delay: 1.5, dur: 14 }, { x: "8%", delay: 6.5, dur: 11 }]
          .map((d, i) => (
            <motion.div key={i} style={{ left: d.x, bottom: 0 }} className="absolute h-1.5 w-1.5 rounded-full bg-primary/25"
              animate={{ y: [0, -440], opacity: [0, 0.65, 0] }} transition={{ duration: d.dur, repeat: Infinity, ease: "easeOut", delay: d.delay }} />
          ))}
      </div>

      <div className="flex min-h-[88vh] flex-col items-center px-6 pt-[10vh] pb-20 text-center">
        <h1 className="mb-8 max-w-4xl" aria-label="Understand your heart, artery by artery.">
          {[{ text: "Understand", cls: "text-foreground" }, { text: "your heart,", cls: "text-foreground" },
            { text: "artery", cls: "text-primary" }, { text: "by artery.", cls: "text-foreground" }].map((line, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.11, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`block font-serif text-[clamp(3.2rem,8vw,5.5rem)] leading-[0.94] font-bold tracking-tight italic ${line.cls}`}>
              {line.text}
            </motion.span>
          ))}
        </h1>

        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}
          className="mb-12 max-w-lg text-lg leading-relaxed text-balance text-muted-foreground md:text-xl">
          An AI estimate of coronary artery disease from {n} questions, mapped onto a 3D heart: which artery, and why.
        </motion.p>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.78, duration: 0.55 }}
          className="relative mb-12 w-full max-w-lg" aria-label="Animated ECG trace" role="img">
          <motion.div aria-hidden="true" animate={{ scale: [1, 1.055, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/20" />
          <motion.div aria-hidden="true" animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.18, 0.1] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
            className="pointer-events-none absolute inset-0 rounded-3xl border border-primary/12" />
          <div className="relative rounded-2xl border border-border/50 bg-card/60 px-6 py-5 backdrop-blur-sm"><EkgWave /></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.98, duration: 0.45 }}
          className="flex flex-col items-center gap-3">
          <motion.div whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}>
            <Button size="lg" onClick={onStart} disabled={!meta}
              className="h-14 rounded-full bg-primary px-10 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90">
              Begin {n}-question assessment
              <motion.span className="ml-2 inline-flex" animate={{ x: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} aria-hidden="true">
                <ArrowRight className="size-5" />
              </motion.span>
            </Button>
          </motion.div>
          <p className="text-xs text-muted-foreground opacity-65">Free · Nothing is stored · About 2 minutes</p>
          {meta && (
            <div className="mt-3">
              <Select onValueChange={(v) => onExample(Number(v))}>
                <SelectTrigger className="h-9 rounded-full border-border/70 bg-card/70 text-sm text-muted-foreground" aria-label="Open an example patient">
                  <SelectValue placeholder="or open a patient from the study" />
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
            </div>
          )}
        </motion.div>
      </div>

      <div className="border-t border-border/50 bg-card/40 px-6 py-16 backdrop-blur-sm">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="mb-12 text-center text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Why you can trust it
        </motion.p>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-3">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }} whileHover={{ y: -5 }}
              className="cursor-default rounded-3xl border border-border bg-card p-8 text-center transition-shadow hover:shadow-lg hover:shadow-primary/8">
              <div className="mb-3 font-serif text-5xl font-bold text-primary tabular-nums">{s.value}</div>
              <div className="text-sm leading-snug text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto mt-12 max-w-xl text-center text-base leading-relaxed text-muted-foreground">
          Trained on {meta?.n_patients ?? 303} patients whose arteries were checked by angiography. The {n} questions alone
          give almost the full accuracy; every answer is explained, and the risk is shown on the LAD, LCX and RCA arteries of a real 3D heart.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.28, duration: 0.45 }}
          className="mt-10 flex justify-center">
          <Button size="lg" onClick={onStart} disabled={!meta} className="h-12 rounded-full bg-foreground px-8 font-semibold text-background hover:bg-foreground/90">
            Start the assessment
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
