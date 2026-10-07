import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pct, TARGETS, VESSELS } from "@/lib/format"
import type { Meta, Metrics, Target } from "@/lib/types"

// Chart series, checked for colour-vision deficiency
const SERIES: Record<Target, string> = { Cath: "#2a78d6", LAD: "#eb6834", LCX: "#4a3aa7", RCA: "#e87ba4" }
const NAME: Record<Target, string> = { Cath: "CAD", LAD: "LAD", LCX: "LCX", RCA: "RCA" }
const HOSPITAL: Record<string, string> = { Tehran: "Tehran, Iran", Cleveland: "Cleveland, USA", Hungary: "Budapest, Hungary", Switzerland: "Zurich & Basel, Switzerland", "Long Beach": "Long Beach, USA" }
const f2 = (x: number) => x.toFixed(2)

export function ModelTab({ meta }: { meta: Meta }) {
  const ev = meta.evaluation
  if (!ev) return <p className="text-sm text-muted-foreground">Validation results are not bundled with this build.</p>
  const m: Record<Target, Metrics> = { Cath: ev.v2_calibrated_with_threshold.Cath, ...ev["v2_two_step_vessels (deployed)"] }
  const cb = meta.clinical_baseline, ext = meta.external_validation, loc = meta.localisation_auc, sets = meta.input_sets

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-y py-5 md:grid-cols-4">
        <Stat label="CAD ROC-AUC" value={f2(m.Cath.auc)} note={`95% CI ${f2(m.Cath.auc_ci_low)} to ${f2(m.Cath.auc_ci_high)}`} />
        <Stat label="Accuracy" value={pct(m.Cath.accuracy)} note="at the 55% cut-off" />
        <Stat label="Catches CAD (recall)" value={pct(m.Cath.sensitivity)} note={`precision ${pct(m.Cath.ppv)}`} />
        <Stat label="Clears healthy (specificity)" value={pct(m.Cath.specificity)} note={`F1 ${f2(m.Cath.f1)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Accuracy by target</CardTitle>
            <CardDescription>{meta.n_patients} patients, 10× repeated nested 5-fold cross-validation: every patient is scored by a model that never saw them.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead><TableHead className="text-right">ROC-AUC</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead><TableHead className="text-right">Precision</TableHead>
                  <TableHead className="text-right">Recall</TableHead><TableHead className="text-right">F1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {TARGETS.map((t) => (
                  <TableRow key={t}>
                    <TableCell className="font-medium">{NAME[t]}</TableCell>
                    <TableCell className="text-right">{f2(m[t].auc)}</TableCell>
                    <TableCell className="text-right">{f2(m[t].accuracy)}</TableCell>
                    <TableCell className="text-right">{f2(m[t].ppv)}</TableCell>
                    <TableCell className="text-right">{f2(m[t].sensitivity)}</TableCell>
                    <TableCell className="text-right">{f2(m[t].f1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {loc && (
              <p className="mt-3 text-xs text-muted-foreground">
                Picking <em>which</em> artery is the hard part: among CAD patients the artery models rank at AUC{" "}
                {VESSELS.map((v) => `${v} ${f2(loc[v])}`).join(", ")}. The data never says where in the heart an ECG or wall-motion finding is.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROC and calibration</CardTitle>
            <CardDescription>Held-out predictions. Closer to the top-left is better (left); dots on the diagonal mean the percentages hold (right).</CardDescription>
          </CardHeader>
          <CardContent><Curves meta={meta} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {cb && (
          <Card>
            <CardHeader>
              <CardTitle>Against doctors' scores</CardTitle>
              <CardDescription>Same {cb.n_patients} patients.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">ROC-AUC</TableHead></TableRow></TableHeader>
                <TableBody className="tabular-nums">
                  {Object.entries(cb.methods).map(([name, r]) => (
                    <TableRow key={name} className={name === "flowstate" ? "font-semibold" : ""}>
                      <TableCell>{name.replace(" pre-test probability", "").replace(" clinical score", "")}</TableCell>
                      <TableCell className="text-right">{f2(r.auc)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                The ESC rule misses {cb.esc_rule_ptp_over_15.missed_cad_patients} CAD patients; flowstate's cut-off misses about {Math.round(cb.flowstate_rule_out_cut_off.missed_cad_patients)}.
              </p>
            </CardContent>
          </Card>
        )}

        {ext && (
          <Card>
            <CardHeader>
              <CardTitle>Other hospitals</CardTitle>
              <CardDescription>A 7-input version, tested on each hospital it never saw.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Hospital</TableHead><TableHead className="text-right">Patients</TableHead><TableHead className="text-right">AUC</TableHead></TableRow></TableHeader>
                <TableBody className="tabular-nums">
                  {ext.calibration.map((c) => (
                    <TableRow key={c.hospital}>
                      <TableCell>{HOSPITAL[c.hospital] ?? c.hospital}</TableCell>
                      <TableCell className="text-right">{c.n}</TableCell>
                      <TableCell className="text-right">{f2(c.auc)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold"><TableCell>Mean</TableCell><TableCell /><TableCell className="text-right">{f2(ext.loco_auc[ext.chosen_model].Mean)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {sets && (
          <Card>
            <CardHeader>
              <CardTitle>How much to enter</CardTitle>
              <CardDescription>CAD accuracy when only some inputs are entered.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Entered</TableHead><TableHead className="text-right">ROC-AUC</TableHead></TableRow></TableHeader>
                <TableBody className="tabular-nums">
                  <TableRow><TableCell>{sets.questions.items} questions, no tests</TableCell><TableCell className="text-right">{sets.questions.auc.toFixed(3)}</TableCell></TableRow>
                  <TableRow className="font-semibold"><TableCell>{sets.key.items} key inputs</TableCell><TableCell className="text-right">{sets.key.auc.toFixed(3)}</TableCell></TableRow>
                  <TableRow><TableCell>Every input</TableCell><TableCell className="text-right">{sets.all.auc.toFixed(3)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="pb-2 text-xs text-muted-foreground">
        Data: Z-Alizadeh Sani extension (UCI #411, CC BY 4.0), 303 patients from one centre in Tehran. Heart model: HuBMAP Human Reference Atlas, female heart v1.0 by Kristen Browne (CC BY 4.0).
      </p>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  )
}

function Curves({ meta }: { meta: Meta }) {
  const hc = meta.heldout_curves
  if (!hc) return null
  const S = 140, TOP = 8, LEFT = [36, 222]
  const X = (i: number, v: number) => LEFT[i] + v * S, Y = (v: number) => TOP + (1 - v) * S
  const pts = (arr: [number, number][], i: number) => arr.map(([a, b]) => `${X(i, a).toFixed(1)},${Y(b).toFixed(1)}`).join(" ")
  const frame = (i: number, xl: string, yl: string) => (
    <g>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={X(i, 0)} x2={X(i, 1)} y1={Y(v)} y2={Y(v)} className="stroke-border" />
          <line x1={X(i, v)} x2={X(i, v)} y1={Y(0)} y2={Y(1)} className="stroke-border" />
          <text x={X(i, v)} y={Y(0) + 13} textAnchor="middle" className="fill-muted-foreground text-[10px]">{v}</text>
          <text x={X(i, 0) - 5} y={Y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{v}</text>
        </g>
      ))}
      <line x1={X(i, 0)} y1={Y(0)} x2={X(i, 1)} y2={Y(1)} className="stroke-muted-foreground" strokeDasharray="3 3" />
      <text x={X(i, 0.5)} y={Y(0) + 27} textAnchor="middle" className="fill-muted-foreground text-[10.5px]">{xl}</text>
      <text transform={`translate(${X(i, 0) - 27} ${Y(0.5)}) rotate(-90)`} textAnchor="middle" className="fill-muted-foreground text-[10.5px]">{yl}</text>
    </g>
  )
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {TARGETS.map((t) => <span key={t} className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 rounded" style={{ background: SERIES[t] }} />{NAME[t]}</span>)}
      </div>
      <svg viewBox="0 0 370 190" className="w-full" role="img" aria-label="ROC curves and calibration plot of the held-out predictions">
        {frame(0, "1 − specificity", "Sensitivity")}
        {frame(1, "Predicted", "Observed")}
        {TARGETS.map((t) => {
          const c = hc.targets[t]
          return (
            <g key={t} fill="none" stroke={SERIES[t]} strokeWidth={2} strokeLinejoin="round">
              <polyline points={pts(c.roc, 0)}><title>{`${NAME[t]}: AUC ${f2(c.auc)}`}</title></polyline>
              <polyline points={pts(c.calibration.map(([a, b]) => [a, b]), 1)} />
              {c.calibration.map(([a, b, n], j) => (
                <circle key={j} cx={X(1, a)} cy={Y(b)} r={3.5} fill={SERIES[t]} className="stroke-card" strokeWidth={1.5}>
                  <title>{`${NAME[t]}, group ${j + 1} (${n} patients): predicted ${pct(a)}, observed ${pct(b)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
