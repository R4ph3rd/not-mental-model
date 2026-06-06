import { useMemo } from 'react'
import { X, Archive, Pin, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { computeDecayScore, decayLabel, decayBarColor } from '@/lib/decay'
import type { MentalModelNode } from '@/types/mental-model'
import { cn } from '@/lib/utils'

interface Props {
  nodes: MentalModelNode[]
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onBumpAccess: (ids: string[]) => void
  onClose: () => void
}

// Score threshold below which a node is considered stale for review
const STALE_THRESHOLD = 0.25

export function staleCount(nodes: MentalModelNode[]): number {
  return nodes.filter(n => n.active && !n.pinned && computeDecayScore(n) < STALE_THRESHOLD).length
}

export function StaleReviewPanel({ nodes, onToggleActive, onTogglePin, onBumpAccess, onClose }: Props) {
  const stale = useMemo(
    () => nodes
      .filter(n => n.active && !n.pinned && computeDecayScore(n) < STALE_THRESHOLD)
      .map(n => ({ n, score: computeDecayScore(n) }))
      .sort((a, b) => a.score - b.score),
    [nodes],
  )

  if (stale.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header count={0} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center t-muted text-sm">
          No stale nodes — knowledge base is healthy.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header count={stale.length} onClose={onClose} />
      <p className="text-[11px] t-muted px-4 pb-3">
        These nodes haven't been accessed in a while. Archive the ones that no longer matter, pin the ones that should never decay, or boost to refresh their recency.
      </p>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {stale.map(({ n, score }) => (
          <StaleRow
            key={n.id}
            node={n}
            score={score}
            onArchive={() => onToggleActive(n.id)}
            onPin={() => onTogglePin(n.id)}
            onBoost={() => onBumpAccess([n.id])}
          />
        ))}
      </div>

      <div className="border-t t-border px-4 py-3 flex items-center gap-2">
        <Button size="sm" variant="ghost"
          onClick={() => stale.forEach(({ n }) => onToggleActive(n.id))}>
          <Archive className="h-3.5 w-3.5" />Archive all
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto"
          onClick={() => onBumpAccess(stale.map(({ n }) => n.id))}>
          <Zap className="h-3.5 w-3.5" />Boost all
        </Button>
      </div>
    </div>
  )
}

function Header({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b t-border shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold t-text">Stale review</span>
        {count > 0 && (
          <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-1.5 py-0.5 font-medium">
            {count}
          </span>
        )}
      </div>
      <button onClick={onClose} className="t-muted hover:t-text transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function StaleRow({ node, score, onArchive, onPin, onBoost }: {
  node: MentalModelNode
  score: number
  onArchive: () => void
  onPin: () => void
  onBoost: () => void
}) {
  const lastTouched = node.lastAccessedAt ?? node.updatedAt
  const days = Math.floor((Date.now() - new Date(lastTouched).getTime()) / 86400000)

  return (
    <div className="rounded-lg border t-border bg-white/[0.02] px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium t-text truncate">{node.title}</p>
          <p className="text-[11px] t-muted mt-0.5 line-clamp-1">{node.content}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="w-16 h-1 rounded-full bg-white/8 overflow-hidden">
            <div className={cn('h-full rounded-full', decayBarColor(score))} style={{ width: `${score * 100}%` }} />
          </div>
          <span className={cn('text-[10px]', score < 0.15 ? 'text-red-400' : 'text-yellow-400')}>
            {decayLabel(score)} · {days}d
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onBoost}
          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors border border-blue-500/30 rounded px-1.5 py-0.5"
        >
          <Zap className="h-2.5 w-2.5" />Boost
        </button>
        <button
          onClick={onPin}
          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 rounded px-1.5 py-0.5"
        >
          <Pin className="h-2.5 w-2.5" />Pin
        </button>
        <button
          onClick={onArchive}
          className="flex items-center gap-1 text-[10px] t-muted hover:text-red-300 transition-colors border t-border rounded px-1.5 py-0.5 ml-auto"
        >
          <Archive className="h-2.5 w-2.5" />Archive
        </button>
      </div>
    </div>
  )
}
