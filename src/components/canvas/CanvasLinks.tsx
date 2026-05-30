import type { MentalModelNode } from '@/types/mental-model'
import { CARD_W, CARD_H } from './layout'

interface Props {
  nodes: MentalModelNode[]
  positions: Record<string, { x: number; y: number }>
}

export function CanvasLinks({ nodes, positions }: Props) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const links: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = []
  const seen = new Set<string>()

  for (const node of nodes) {
    for (const linkedId of node.linkedIds) {
      const key = [node.id, linkedId].sort().join('--')
      if (seen.has(key) || !nodeMap.has(linkedId)) continue
      seen.add(key)
      const p1 = positions[node.id]
      const p2 = positions[linkedId]
      if (!p1 || !p2) continue
      links.push({
        key,
        x1: p1.x + CARD_W / 2,
        y1: p1.y + CARD_H / 2,
        x2: p2.x + CARD_W / 2,
        y2: p2.y + CARD_H / 2,
      })
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <marker id="mm-arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="rgba(139,92,246,0.4)" />
        </marker>
      </defs>
      {links.map(l => (
        <line
          key={l.key}
          x1={l.x1} y1={l.y1}
          x2={l.x2} y2={l.y2}
          stroke="rgba(139,92,246,0.25)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          markerEnd="url(#mm-arrow)"
        />
      ))}
    </svg>
  )
}
