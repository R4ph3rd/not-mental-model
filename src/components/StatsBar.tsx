import type { MentalModelNode } from '@/types/mental-model'
import { CONFIDENCE_COLORS } from '@/types/mental-model'

interface Props {
  nodes: MentalModelNode[]
  selectedCount: number
}

export function StatsBar({ nodes, selectedCount }: Props) {
  const high = nodes.filter(n => n.confidence === 'high').length
  const medium = nodes.filter(n => n.confidence === 'medium').length
  const low = nodes.filter(n => n.confidence === 'low').length
  const active = nodes.filter(n => n.active).length
  const pinned = nodes.filter(n => n.pinned).length
  const episodic = nodes.filter(n => n.memoryType === 'episodic').length

  return (
    <div className="flex items-center gap-5 text-xs text-white/35 flex-wrap">
      <span><span className={`font-medium ${CONFIDENCE_COLORS.high}`}>{high}</span> high</span>
      <span><span className={`font-medium ${CONFIDENCE_COLORS.medium}`}>{medium}</span> medium</span>
      <span><span className={`font-medium ${CONFIDENCE_COLORS.low}`}>{low}</span> low confidence</span>
      <span className="text-white/15">·</span>
      <span><span className="font-medium text-green-400">{active}</span> active</span>
      <span><span className="font-medium text-amber-400">{pinned}</span> pinned</span>
      <span><span className="font-medium text-violet-400">{episodic}</span> episodic</span>
      {selectedCount > 0 && (
        <>
          <span className="text-white/15">·</span>
          <span className="font-medium text-purple-300">{selectedCount} selected</span>
        </>
      )}
    </div>
  )
}
