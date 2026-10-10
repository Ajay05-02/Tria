// Page frame, after Kard (github.com/7-Bala/Kard, MIT): sticky header with the progress dots, and a footer
import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { WORDMARK } from "@/lib/wordmark"

export type Screen = "hero" | "name" | "question" | "details" | "analyzing" | "results" | "insights" | "about" | "privacy" | "terms"

interface Props {
  children: ReactNode
  screen: Screen
  total: number
  current: number
  answered: (i: number) => boolean
  onHome: () => void
  onJump: (i: number) => void
  onNavigate: (s: Screen) => void
}

// The progress dots are also a scrubber: press one, or hold and drag along the row, to move between questions.
// Each dot sits in a slot of fixed width, so the row never shifts under the pointer, and the position along the
// row (not the dot under the pointer) picks the question, so gaps and touch drags work. While dragging, only the
// dots and the counter follow; the page changes once the pointer rests or lifts, not on every dot it crosses.
function ProgressDots({ total, current, answered, onScrub, onJump }: {
  total: number; current: number; answered: (i: number) => boolean; onScrub: (i: number | null) => void; onJump: (i: number) => void
}) {
  const at = useRef(-1)
  const rest = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (rest.current) clearTimeout(rest.current) }, [])

  const index = (el: HTMLElement, clientX: number) => {
    const box = el.getBoundingClientRect()
    const open = Array.from({ length: total }, (_, k) => k).find((k) => !answered(k)) ?? total - 1   // cannot skip ahead
    return Math.min(open, Math.max(0, Math.floor(((clientX - box.left) / box.width) * total)))
  }
  const move = (el: HTMLElement, clientX: number, now: boolean) => {
    const i = index(el, clientX)
    if (i === at.current && !now) return
    at.current = i
    onScrub(i)
    if (rest.current) clearTimeout(rest.current)
    if (now) onJump(i); else rest.current = setTimeout(() => onJump(i), 140)
  }
  const end = () => {
    if (at.current < 0) return
    if (rest.current) clearTimeout(rest.current)
    onJump(at.current)
    at.current = -1
    onScrub(null)
  }

  // keyboard: arrows step one question (never past the first unanswered one: the parent caps the jump), Home and End go to the ends
  const key = (e: React.KeyboardEvent) => {
    const to = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1, ArrowDown: current - 1, Home: 0, End: total - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    onJump(Math.min(total - 1, Math.max(0, to)))
  }

  return (
    <div className="-my-3 flex cursor-pointer touch-none rounded-md py-3 select-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      role="slider" tabIndex={0} aria-label="Question" aria-orientation="horizontal"
      aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-valuetext={`Question ${current + 1} of ${total}`}
      onKeyDown={key}
      onPointerDown={(e) => {
        e.preventDefault()
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* the drag still works while the pointer stays over the row */ }
        move(e.currentTarget, e.clientX, true)
      }}
      onPointerMove={(e) => { if (at.current >= 0) move(e.currentTarget, e.clientX, false) }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex w-4 justify-center sm:w-5">
          <div className={cn("h-1.5 rounded-full transition-[width,background-color,opacity] duration-200",
            i === current ? "w-[calc(100%-2px)] bg-primary opacity-70" : answered(i) ? "w-2.5 bg-primary sm:w-3" : "w-2.5 bg-border sm:w-3")} />
        </div>
      ))}
    </div>
  )
}

// The wordmark beats like the loader's while the pointer is on it (or it has keyboard focus). Leaving does not cut
// the beat short: the current one finishes first, so the logo never snaps back from the middle of a contraction.
function Wordmark({ onHome }: { onHome: () => void }) {
  const [beating, setBeating] = useState(false)
  const wanted = useRef(false)
  const want = (on: boolean) => { wanted.current = on; if (on) setBeating(true) }
  return (
    <button id="logo-btn" onClick={onHome} aria-label="Tria: go to the start page" data-beating={beating || undefined}
      onPointerEnter={() => want(true)} onPointerLeave={() => want(false)}
      onFocus={(e) => want(e.currentTarget.matches(":focus-visible"))} onBlur={() => want(false)}
      className="flex items-center gap-2 rounded-sm text-xl font-semibold tracking-tight text-foreground transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
      {/* Hand-drawn wordmark; it takes the button's text colour */}
      <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} className={cn("h-8 w-auto", beating && "logo-beat")} fill="none" stroke="currentColor"
        strokeWidth={WORDMARK.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        onAnimationIteration={() => { if (!wanted.current) setBeating(false) }}>
        {WORDMARK.paths.map((d) => <path key={d} d={d} />)}
      </svg>
    </button>
  )
}

export function Layout({ children, screen, total, current, answered, onHome, onJump, onNavigate }: Props) {
  const [scrub, setScrub] = useState<number | null>(null)   // the dot under a drag, shown before the page follows
  const shown = scrub ?? current
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-background px-5 py-3 lg:px-8">
          <Wordmark onHome={onHome} />

          {screen === "question" ? (
            <div className="flex items-center gap-2">
              <ProgressDots total={total} current={shown} answered={answered} onScrub={setScrub} onJump={onJump} />
              <span className="min-w-[2.4rem] text-right text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">{shown + 1}/{total}</span>
            </div>
          ) : (
            <nav className="flex items-center gap-1 text-sm">
              <button onClick={() => onNavigate("insights")}
                className={cn("rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  screen === "insights" && "bg-secondary text-foreground")}>
                How accurate is it?
              </button>
            </nav>
          )}
        </header>

        <main id="main-content" className="flex flex-1 flex-col overflow-x-hidden">{children}</main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t px-5 py-4 sm:flex-row lg:px-8">
          <p className="text-xs text-muted-foreground">
            Educational prototype. Not a medical device or a substitute for coronary angiography.
          </p>
          <nav aria-label="Footer links" className="flex gap-5 text-xs text-muted-foreground">
            {(["about", "privacy", "terms"] as const).map((s) => (
              <button key={s} onClick={() => onNavigate(s)}
                className="rounded-sm capitalize transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none">
                {s}
              </button>
            ))}
          </nav>
        </footer>
      </div>
    </>
  )
}
