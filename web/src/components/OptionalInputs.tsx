import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { ChoiceGroup, Field, Inputs, Meta } from "@/lib/types"

interface Props {
  meta: Meta
  inputs: Inputs
  touched: Set<string>
  fromBlank: boolean
  focus: { id: string; n: number } | null
  onChange: (id: string, values: Inputs) => void
}

// One form row. `id` is the input (or grouped choice) that "click to edit" names.
type Row = { id: string; kind: "field"; field: Field } | { id: string; kind: "choice"; group: ChoiceGroup } | { id: string; kind: "chips"; group: ChoiceGroup }

// The optional inputs (everything except the 11 key questions): plain rows in searchable, collapsible groups
export function OptionalInputs({ meta, inputs, touched, fromBlank, focus, onChange }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<string[]>([])
  const root = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => buildRows(meta), [meta])

  // "Click to edit" from the results: open the right group, scroll to the row and flash it
  useEffect(() => {
    if (!focus) return
    const group = groups.find((g) => g.rows.some((r) => r.id === focus.id))
    if (group) { setQuery(""); setOpen((o) => (o.includes(group.name) ? o : [...o, group.name])) }
    const t = setTimeout(() => {
      const row = root.current?.querySelector<HTMLElement>(`[data-control="${CSS.escape(focus.id)}"]`)
      if (!row) return
      row.scrollIntoView({ block: "center", behavior: "smooth" })
      row.querySelector<HTMLElement>("input, button[data-state=on], button")?.focus({ preventScroll: true })
      row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash")
    }, 250)
    return () => clearTimeout(t)
  }, [focus, groups])

  const q = query.trim().toLowerCase()
  const visible = (g: { name: string; rows: Row[] }) =>
    !q || g.name.toLowerCase().includes(q) ? g.rows : g.rows.filter((r) => rowLabel(r).toLowerCase().includes(q))
  const shown = groups.map((g) => ({ ...g, rows: visible(g) })).filter((g) => g.rows.length)

  return (
    <div ref={root} className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a test or finding" className="h-10 rounded-xl bg-card pl-9" aria-label="Find an input" />
      </div>
      {shown.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nothing matches.</p>}
      <Accordion type="multiple" value={q ? shown.map((g) => g.name) : open} onValueChange={(v) => { if (!q) setOpen(v) }}
        className="rounded-2xl border bg-card px-4">
        {shown.map((g) => {
          const n = g.rows.filter((r) => touched.has(r.id)).length
          return (
            <AccordionItem key={g.name} value={g.name}>
              <AccordionTrigger className="py-3.5 text-sm font-medium">
                <span className="flex flex-1 items-center justify-between pr-2">
                  {g.name}
                  {fromBlank && n > 0 && <span className="text-xs font-normal text-primary">{n} entered</span>}
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3 pb-4">
                {g.rows.map((r) => <FormRow key={r.id} row={r} inputs={inputs} assumed={fromBlank && !touched.has(r.id)} onChange={onChange} />)}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}

function buildRows(meta: Meta) {
  const fields = Object.fromEntries(meta.fields.map((f) => [f.key, f]))
  const all: ChoiceGroup[] = [...meta.composites, ...meta.chip_groups]
  const grouped = new Set(all.flatMap((g) => g.features))
  const make = (id: string): Row => {
    const chips = meta.chip_groups.find((g) => g.id === id)
    if (chips) return { id, kind: "chips", group: chips }
    const choice = meta.composites.find((g) => g.id === id)
    if (choice) return { id, kind: "choice", group: choice }
    return { id, kind: "field", field: fields[id] }
  }
  return meta.groups.map((name) => ({
    name,
    rows: [
      ...all.filter((g) => g.group === name).map((g) => g.id),
      ...meta.fields.filter((f) => f.group === name && !grouped.has(f.key)).map((f) => f.key),
    ].filter((id) => !meta.key_inputs.includes(id)).map(make),
  })).filter((g) => g.rows.length)
}

const rowLabel = (r: Row) => (r.kind === "field" ? `${r.field.label} ${r.field.unit} ${r.field.hint}` : `${r.group.label} ${r.group.hint ?? ""}`)

function noteFor(f: Field) {
  if (f.key === "BMI") return `${f.unit}, from weight and height`
  return [f.unit, f.hint].filter(Boolean).join(", ")
}

function FormRow({ row, inputs, assumed, onChange }: { row: Row; inputs: Inputs; assumed: boolean; onChange: (id: string, v: Inputs) => void }) {
  const label = row.kind === "field" ? row.field.label : row.group.label
  const note = row.kind === "field" ? noteFor(row.field) : row.group.hint
  const labelId = `lbl-${row.id.replace(/[^a-z0-9]+/gi, "-")}`

  let control: React.ReactNode
  let stacked = false
  if (row.kind === "field" && row.field.kind === "number") {
    control = <NumberInput field={row.field} value={inputs[row.field.key]} assumed={assumed} labelId={labelId} onChange={(v) => onChange(row.id, { [row.field.key]: v })} />
  } else if (row.kind === "chips") {
    stacked = true
    const g = row.group
    const on = g.features.filter((k) => inputs[k] === 1)
    control = (
      <ToggleGroup type="multiple" variant="outline" size="sm" spacing={1} aria-labelledby={labelId} className="flex w-full flex-wrap"
        value={on.length ? on : ["none"]}
        onValueChange={(vals) => {
          const turnedNone = vals.includes("none") && on.length > 0
          onChange(row.id, Object.fromEntries(g.features.map((k) => [k, !turnedNone && vals.includes(k) ? 1 : 0])))
        }}>
        <ToggleGroupItem value="none" className={choiceClass(assumed)}>None</ToggleGroupItem>
        {g.features.map((k, i) => <ToggleGroupItem key={k} value={k} className={choiceClass(assumed)}>{g.labels![i]}</ToggleGroupItem>)}
      </ToggleGroup>
    )
  } else {
    // single choice: yes/no, a list of options, or a grouped choice that sets several inputs
    let labels: string[], current: number, pick: (i: number) => Inputs
    if (row.kind === "choice") {
      const g = row.group
      labels = g.options!.map((o) => o.label)
      current = g.options!.findIndex((o) => o.values.every((v, j) => inputs[g.features[j]] === v))
      pick = (i) => Object.fromEntries(g.features.map((k, j) => [k, g.options![i].values[j]]))
    } else {
      const f = row.field
      const values = f.kind === "binary" ? [0, 1] : Object.keys(f.options!).map(Number)
      labels = f.kind === "binary" ? ["No", "Yes"] : Object.values(f.options!)
      current = values.indexOf(Math.round(inputs[f.key]))
      pick = (i) => ({ [f.key]: values[i] })
    }
    stacked = labels.length > 2
    const longest = Math.max(...labels.map((l) => l.length))
    const cols = labels.length <= 3 || longest <= 4 ? labels.length : 2
    control = (
      <ToggleGroup type="single" variant="outline" size="sm" spacing={stacked ? 1 : 0} aria-labelledby={labelId}
        className={cn(stacked ? "grid w-full" : "w-28")}
        // (the component sets --gap itself; passing a style replaces it, so it is repeated here)
        style={stacked ? ({ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, "--gap": 1 } as React.CSSProperties) : undefined}
        value={current >= 0 ? String(current) : ""}
        // clicking the chosen button again still counts as entering it
        onValueChange={(v) => onChange(row.id, pick(v === "" ? current : Number(v)))}>
        {labels.map((l, i) => <ToggleGroupItem key={l} value={String(i)} className={cn("flex-1", choiceClass(assumed))}>{l}</ToggleGroupItem>)}
      </ToggleGroup>
    )
  }

  return (
    <div data-control={row.id} className={cn("form-row grid items-center gap-x-3 gap-y-1.5 rounded-md", stacked ? "grid-cols-1" : "grid-cols-[1fr_auto]")}>
      <div className="min-w-0">
        <div id={labelId} className="text-sm leading-tight">{label}</div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </div>
      {control}
    </div>
  )
}

// Entered choices are solid; typical defaults not yet entered are faded
const choiceClass = (assumed: boolean) =>
  assumed
    ? "data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/30"
    : "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"

function NumberInput({ field, value, assumed, labelId, onChange }: { field: Field; value: number; assumed: boolean; labelId: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100))
  useEffect(() => { setText(String(Math.round(value * 100) / 100)) }, [value])
  const v = parseFloat(text)
  const outOfRange = Number.isFinite(v) && (v < field.min || v > field.max)
  return (
    <Input type="number" inputMode="decimal" step={field.step} value={text} aria-labelledby={labelId}
      readOnly={field.key === "BMI"}
      title={`Range seen in training: ${field.min} to ${field.max}`}
      aria-invalid={!Number.isFinite(v) || outOfRange || undefined}
      className={cn("h-8 w-28 text-right tabular-nums", assumed && "text-muted-foreground", field.key === "BMI" && "bg-muted/50")}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseFloat(e.target.value)
        if (Number.isFinite(n)) onChange(n)
      }} />
  )
}
