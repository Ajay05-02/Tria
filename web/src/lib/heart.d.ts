// Types for heart.js, the framework-free Three.js scene (heart, arteries, labels)
import type { Color } from "three"

export interface VesselRisk { probability: number; score: number; high: boolean; text?: string }

export interface HeartViewer {
  tintArteries(scores: Record<"LAD" | "LCX" | "RCA", number>): void
  setRisks(risks: Record<"LAD" | "LCX" | "RCA", VesselRisk>): void
  select(name: string | null): void
  setLabelNames(names: Record<string, string>): void
  snapshot(scale?: number): string
  setHeartRate(bpm: number): void
  setBeating(on: boolean): void
  freezeAt(squeeze: number): void
  setQuality(quality: "full" | "lite"): void
  quality(): "full" | "lite"
  lookFrom(x: number, y: number, z: number): void
  distanceToArteries(x: number, y: number): number
  screenPointOf(name: string): { x: number; y: number } | null
  setTerritories(on: boolean): void
  resetView(): void
  dispose(): void
}

export function riskColor(score: number): Color
export function createHeartViewer(
  container: HTMLElement,
  options?: { onSelect?: (vessel: string | null) => void; reduceMotion?: boolean; zoom?: boolean; labels?: boolean },
): HeartViewer
