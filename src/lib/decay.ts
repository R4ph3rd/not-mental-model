import type { MentalModelNode, ConfidenceLevel } from '@/types/mental-model'

const CONF_WEIGHT: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
}

// Xu 2025: composite decay score = recency × 0.4 + importance × 0.35 + confidence × 0.25
// Pinned nodes are always retained at full score.
export function computeDecayScore(node: MentalModelNode): number {
  if (node.pinned) return 1.0
  const lastTouched = node.lastAccessedAt ?? node.updatedAt
  const daysSince = (Date.now() - new Date(lastTouched).getTime()) / 86400000
  const recency = Math.max(0, 1 - daysSince / 90)
  const conf = CONF_WEIGHT[node.confidence]
  return Math.min(1, recency * 0.4 + node.importance * 0.35 + conf * 0.25)
}

export function decayLabel(score: number): string {
  if (score >= 0.75) return 'strong'
  if (score >= 0.5) return 'stable'
  if (score >= 0.25) return 'fading'
  return 'stale'
}

export function decayBarColor(score: number): string {
  if (score >= 0.75) return 'bg-green-500'
  if (score >= 0.5) return 'bg-blue-500'
  if (score >= 0.25) return 'bg-yellow-500'
  return 'bg-red-500'
}
