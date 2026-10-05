// Page frame, after Kard (github.com/7-Bala/Kard, MIT): sticky header with the progress dots, and a footer
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Screen = "hero" | "question" | "details" | "analyzing" | "results" | "insights" | "about" | "privacy" | "terms"

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

export function Layout({ children, screen, total, current, answered, onHome, onJump, onNavigate }: Props) {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/40 bg-background/85 px-5 py-3.5 backdrop-blur-lg">
          <button id="logo-btn" onClick={onHome} aria-label="flowstate: go to the start page"
            className="flex items-center gap-2 rounded-sm font-serif text-2xl font-semibold italic text-foreground transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <img src="logo.svg" alt="" className="size-7 not-italic" />
            flowstate
          </button>

          {screen === "question" ? (
            <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1}
              aria-label={`Question ${current + 1} of ${total}`}>
              <div className="-my-2 flex touch-none gap-1 py-2" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <div key={i}
                    onPointerDown={(e) => { e.preventDefault(); onJump(i) }}
                    onPointerEnter={(e) => { if (e.buttons === 1) onJump(i) }}
                    className={cn("h-1.5 cursor-pointer rounded-full transition-all duration-300",
                      i === current ? "w-5 bg-primary opacity-70" : answered(i) ? "w-3 bg-primary" : "w-3 bg-border hover:bg-border/80")} />
                ))}
              </div>
              <span className="ml-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{current + 1}/{total}</span>
            </div>
          ) : (
            <nav className="flex items-center gap-1 text-sm">
              <button onClick={() => onNavigate("insights")}
                className={cn("rounded-full px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  screen === "insights" && "bg-secondary text-foreground")}>
                How accurate is it?
              </button>
            </nav>
          )}
        </header>

        <main id="main-content" className="flex flex-1 flex-col overflow-x-hidden">{children}</main>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-border/40 bg-card/30 px-6 py-5 sm:flex-row">
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
