import { Eye, EyeOff, Pin, Edit2, Trash2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode } from '@/types/mental-model'
import { CATEGORY_COLORS, CATEGORY_LABELS, CONFIDENCE_COLORS } from '@/types/mental-model'
import { CARD_W } from './layout'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode
  position: { x: number; y: number }
  selected: boolean
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onEditRequest: (id: string) => void
}

export function CanvasNode({
  node, position, selected,
  onMouseDown, onToggleActive, onTogglePin, onDelete, onEditRequest,
}: Props) {
  const decay = computeDecayScore(node)

  return (
    <div
      className={cn(
        'absolute rounded-xl border flex flex-col select-none',
        'cursor-grab active:cursor-grabbing t-card',
        'transition-shadow duration-150',
        selected
          ? 't-accent-border shadow-[0_0_0_2px_hsl(var(--p-h)_var(--p-s)_var(--p-l)_/_0.25)]'
          : 't-border hover:border-white/25',
        !node.active && 'opacity-45',
      )}
      style={{ left: position.x, top: position.y, width: CARD_W }}
      onMouseDown={e => onMouseDown(e, node.id)}
      onDoubleClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0', CATEGORY_COLORS[node.category])}>
          {CATEGORY_LABELS[node.category]}
        </span>
        <span className={cn('text-[10px] shrink-0', CONFIDENCE_COLORS[node.confidence])}>●</span>

        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {/* Pin */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-5 w-5 flex items-center justify-center rounded transition-colors',
                  node.pinned ? 'text-amber-400' : 't-muted hover:t-text')}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
              >
                <Pin className="h-3 w-3" fill={node.pinned ? 'currentColor' : 'none'} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.pinned ? 'Unpin' : 'Pin to retain'}</TooltipContent>
          </Tooltip>

          {/* Eye */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-5 w-5 flex items-center justify-center rounded transition-colors',
                  node.active ? 't-muted hover:t-text' : 'text-red-400 hover:text-red-300')}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
              >
                {node.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.active ? 'Hide from agent' : 'Show to agent'}</TooltipContent>
          </Tooltip>

          {/* Edit */}
          <button
            className="h-5 w-5 flex items-center justify-center rounded t-muted hover:t-text transition-colors"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
            title="Edit (or double-click)"
          >
            <Edit2 className="h-3 w-3" />
          </button>

          {/* Delete */}
          <button
            className="h-5 w-5 flex items-center justify-center rounded t-muted hover:text-red-400 transition-colors"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="px-3 pb-1">
        <p className="text-xs font-semibold t-text leading-snug line-clamp-2">{node.title}</p>
      </div>

      {/* Content */}
      <div className="px-3 pb-2">
        <p className="text-[11px] t-muted leading-relaxed line-clamp-3">{node.content}</p>
      </div>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {node.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[9px] t-muted border t-border rounded px-1 py-0.5">#{t}</span>
          ))}
        </div>
      )}

      {/* Memory type + scope */}
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[9px]">
        <span className={cn('px-1 py-0.5 rounded border',
          node.memoryType === 'episodic'
            ? 'border-violet-500/30 text-violet-400/70'
            : 'border-teal-500/30 text-teal-400/70')}>
          {node.memoryType}
        </span>
        {node.scope && <span className="t-muted">· {node.scope}</span>}
      </div>

      {/* Decay bar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mx-3 mb-2.5 cursor-help">
            <div className="h-0.5 rounded-full bg-white/8 overflow-hidden">
              <div className={cn('h-full rounded-full', decayBarColor(decay))}
                style={{ width: `${decay * 100}%` }} />
            </div>
            <p className="text-[9px] t-muted mt-0.5">{decayLabel(decay)} · {Math.round(decay * 100)}%</p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Retention: {Math.round(decay * 100)}%</p>
          <p className="text-[11px] t-muted">Recency × 0.4 + Importance × 0.35 + Confidence × 0.25</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
