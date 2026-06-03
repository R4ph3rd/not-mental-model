import { Eye, EyeOff, Pin, Edit2, Trash2, Lock, Unlock, FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode, NodeCategory } from '@/types/mental-model'
import { CATEGORY_COLORS, CATEGORY_LABELS, CONFIDENCE_COLORS } from '@/types/mental-model'
import { CARD_W } from './layout'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<NodeCategory, React.ReactNode> = {
  project:      <FolderKanban className="h-3 w-3" />,
  conversation: <MessageSquare className="h-3 w-3" />,
  fact:         <Lightbulb className="h-3 w-3" />,
  preference:   <Heart className="h-3 w-3" />,
  goal:         <Target className="h-3 w-3" />,
  skill:        <Zap className="h-3 w-3" />,
}

interface Props {
  node: MentalModelNode
  position: { x: number; y: number }
  selected: boolean
  groupColor?: string
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleSensitive?: (id: string) => void
  onDelete: (id: string) => void
  onEditRequest: (id: string) => void
}

export function CanvasNode({
  node, position, selected, groupColor,
  onMouseDown, onToggleActive, onTogglePin, onToggleSensitive, onDelete, onEditRequest,
}: Props) {
  const decay = computeDecayScore(node)

  return (
    <div
      className={cn(
        'group absolute rounded-xl border flex flex-col select-none overflow-hidden',
        'cursor-grab active:cursor-grabbing t-card',
        'transition-shadow duration-150',
        selected
          ? 't-accent-border shadow-[0_0_0_2px_hsl(var(--p-h)_var(--p-s)_var(--p-l)_/_0.25)]'
          : 't-border hover:border-white/25',
        !node.active && 'opacity-45',
      )}
      style={{
        left: position.x, top: position.y, width: CARD_W,
        borderLeftColor: groupColor ?? undefined,
        borderLeftWidth: groupColor ? '3px' : undefined,
      }}
      onMouseDown={e => onMouseDown(e, node.id)}
      onDoubleClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
    >
      {/* Category title bar — matches grid card style */}
      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0', CATEGORY_COLORS[node.category])}>
        {CATEGORY_ICONS[node.category]}
        <span className="text-[11px] font-semibold leading-none">{CATEGORY_LABELS[node.category]}</span>
        <span className={cn('text-[10px] opacity-70 ml-0.5',
          node.memoryType === 'episodic' ? 'text-violet-200' : 'text-teal-200')}>
          {node.memoryType}
        </span>
        <span className={cn('text-[10px] shrink-0 ml-1', CONFIDENCE_COLORS[node.confidence])}>●</span>

        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {/* Sensitive — always visible when active, hover-only otherwise */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-5 w-5 flex items-center justify-center rounded transition-opacity',
                  node.sensitive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleSensitive?.(node.id) }}
              >
                {node.sensitive ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.sensitive ? 'Sensitive — excluded from context' : 'Mark as sensitive'}</TooltipContent>
          </Tooltip>

          {/* Pin — always visible when pinned */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-5 w-5 flex items-center justify-center rounded transition-opacity',
                  node.pinned ? 'text-amber-300 opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
              >
                <Pin className="h-3 w-3" fill={node.pinned ? 'currentColor' : 'none'} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.pinned ? 'Unpin' : 'Pin to retain'}</TooltipContent>
          </Tooltip>

          {/* Eye — always visible when hidden */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-5 w-5 flex items-center justify-center rounded transition-opacity',
                  !node.active ? 'text-red-300 opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
              >
                {node.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.active ? 'Hide from agent' : 'Show to agent'}</TooltipContent>
          </Tooltip>

          <button
            className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
            title="Edit"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-300 transition-opacity"
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
            <span key={t} className="text-[9px] t-muted border t-border rounded-full px-1.5 py-0.5">#{t}</span>
          ))}
        </div>
      )}


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
