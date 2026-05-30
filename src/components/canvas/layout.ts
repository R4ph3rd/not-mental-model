import type { MentalModelNode, NodeCategory } from '@/types/mental-model'

export const CARD_W = 240
export const CARD_H = 160

const CLUSTER_CENTERS: Record<NodeCategory, { x: number; y: number }> = {
  project:      { x:  80,  y:  80 },
  conversation: { x: 600,  y:  80 },
  fact:         { x: 340,  y: 380 },
  preference:   { x: 940,  y: 220 },
  goal:         { x: 120,  y: 560 },
  skill:        { x: 780,  y: 500 },
}

export function computeDefaultPositions(nodes: MentalModelNode[]): Record<string, { x: number; y: number }> {
  const catIndex: Record<string, number> = {}
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    if (node.position) {
      positions[node.id] = node.position
      continue
    }
    const idx = catIndex[node.category] ?? 0
    catIndex[node.category] = idx + 1
    const center = CLUSTER_CENTERS[node.category]
    const col = idx % 3
    const row = Math.floor(idx / 3)
    positions[node.id] = {
      x: center.x + col * (CARD_W + 20),
      y: center.y + row * (CARD_H + 20),
    }
  }
  return positions
}
