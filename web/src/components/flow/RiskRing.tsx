// The ring on the results page: it fills to the chance of coronary artery disease, once, when the result appears
import { cn } from "@/lib/utils"

export const RiskRing = ({ value, color, className }: { value: number; color: string; className?: string }) => {
  const r = 42
  const circumference = 2 * Math.PI * r
  const offset = circumference - (value / 100) * circumference
  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full -rotate-90", className)} aria-hidden="true">
      <style>{`
        @keyframes ringFill { from { stroke-dashoffset: ${circumference}; } to { stroke-dashoffset: ${offset}; } }
        .risk-r { stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; animation: ringFill 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @media (prefers-reduced-motion: reduce) { .risk-r { animation: none; } }
      `}</style>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" className="risk-r" />
    </svg>
  )
}
