import type { MentalModelNode } from '@/types/mental-model'
import { CONFIDENCE_COLORS } from '@/types/mental-model'

interface Props {
  nodes: MentalModelNode[]
}

export function StatsBar({ nodes }: Props) {
  const high = nodes.filter(n => n.confidence === 'high').length
  const medium = nodes.filter(n => n.confidence === 'medium').length
  const low = nodes.filter(n => n.confidence === 'low').length
  const linked = nodes.filter(n => n.linkedIds.length > 0).length

  return (
    <div className="flex items-center gap-6 text-xs text-white/40">
      <span><span className={`font-medium ${CONFIDENCE_COLORS.high}`}>{high}</span> high</span>
      <span><span className={`font-medium ${CONFIDENCE_COLORS.medium}`}>{medium}</span> medium</span>
      <span><span className={`font-medium ${CONFIDENCE_COLORS.low}`}>{low}</span> low confidence</span>
      <span className="text-white/20">·</span>
      <span><span className="font-medium text-white/60">{linked}</span> linked</span>
      <span><span className="font-medium text-white/60">{nodes.length}</span> total</span>
    </div>
  )
}
