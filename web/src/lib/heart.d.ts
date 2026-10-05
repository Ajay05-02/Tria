// Types for heart.js, the framework-free Three.js scene (heart, arteries, labels, torso)
import type { Color } from "three"

export interface VesselRisk { probability: number; score: number; high: boolean; text?: string }

export interface HeartViewer {
  setRisks(risks: Record<"LAD" | "LCX" | "RCA", VesselRisk>): void
  select(name: string | null): void
  setLabelNames(names: Record<string, string>): void
  snapshot(scale?: number): string
  setHeartRate(bpm: number): void
  setBeating(on: boolean): void
  setTorso(on: boolean): void
  setTerritories(on: boolean): void
  resetView(): void
  dispose(): void
}

export function riskScore(p: number, threshold: number): number
export function riskColor(score: number): Color
export function createHeartViewer(
  container: HTMLElement,
  options?: { onSelect?: (vessel: string | null) => void; reduceMotion?: boolean },
): HeartViewer
