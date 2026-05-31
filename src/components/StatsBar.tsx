import type { MentalModelNode } from '@/types/mental-model'
import { CONFIDENCE_COLORS } from '@/types/mental-model'

interface Props {
  nodes: MentalModelNode[]
}

export function StatsBar({ nodes }: Props) {
  const high     = nodes.filter(n => n.confidence === 'high').length
  const medium   = nodes.filter(n => n.confidence === 'medium').length
  const low      = nodes.filter(n => n.confidence === 'low').length
  const active   = nodes.filter(n => n.active).length
  const pinned   = nodes.filter(n => n.pinned).length
  const episodic = nodes.filter(n => n.memoryType === 'episodic').length
  const semantic = nodes.filter(n => n.memoryType === 'semantic').length

  return (
    <div className="flex items-center gap-3 text-xs text-white/35 flex-wrap">
      <span className="text-white/25 font-semibold uppercase tracking-widest text-[10px]">Confidence</span>
      <span><span className={`font-semibold ${CONFIDENCE_COLORS.high}`}>{high}</span> high</span>
      <span><span className={`font-semibold ${CONFIDENCE_COLORS.medium}`}>{medium}</span> medium</span>
      <span><span className={`font-semibold ${CONFIDENCE_COLORS.low}`}>{low}</span> low</span>
      <span className="text-white/15">|</span>
      <span><span className="font-semibold text-green-400">{active}</span> active</span>
      <span><span className="font-semibold text-amber-400">{pinned}</span> pinned</span>
      <span><span className="font-semibold text-violet-400">{episodic}</span> episodic</span>
      <span><span className="font-semibold text-teal-400">{semantic}</span> semantic</span>
    </div>
  )
}
