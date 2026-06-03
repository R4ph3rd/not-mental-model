import { useState } from 'react'
import { Eye, EyeOff, Pin, Trash2, Lock, Unlock, FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap, MoreVertical } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode, NodeCategory } from '@/types/mental-model'
import { CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
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
  const [menuOpen, setMenuOpen] = useState(false)

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
        backgroundImage: groupColor
          ? `linear-gradient(${groupColor.replace(')', ' / 0.08)')}, ${groupColor.replace(')', ' / 0.08)')})`
          : undefined,
      }}
      onMouseDown={e => onMouseDown(e, node.id)}
      onDoubleClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
    >
      {/* Colored title bar */}
      <div className={cn('flex flex-col px-3 py-1.5 border-b shrink-0', CATEGORY_COLORS[node.category])}>
        {/* Row 1: category icon + node title + status icons + 3-dots */}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0">{CATEGORY_ICONS[node.category]}</span>
          <span className="text-[11px] font-semibold leading-none flex-1 truncate">{node.title}</span>

          {/* Active-state status icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {node.pinned && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded text-amber-300"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
                  >
                    <Pin className="h-3 w-3" fill="currentColor" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Unpin</TooltipContent>
              </Tooltip>
            )}
            {node.sensitive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onToggleSensitive?.(node.id) }}
                  >
                    <Lock className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sensitive — click to remove</TooltipContent>
              </Tooltip>
            )}
            {!node.active && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded text-red-300"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
                  >
                    <EyeOff className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Hidden — click to show</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* 3-dots menu */}
          <div className="relative shrink-0">
            <button
              className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            >
              <MoreVertical className="h-3 w-3" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onMouseDown={e => { e.stopPropagation(); setMenuOpen(false) }}
                />
                <div
                  className="absolute right-0 top-6 z-50 rounded-lg border t-border shadow-xl py-1 min-w-[160px]"
                  style={{ backgroundColor: 'rgb(var(--bg-card))' }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/8 transition-colors text-left t-text"
                    onClick={e => { e.stopPropagation(); onTogglePin(node.id); setMenuOpen(false) }}
                  >
                    <Pin className="h-3 w-3 shrink-0" fill={node.pinned ? 'currentColor' : 'none'} />
                    {node.pinned ? 'Unpin' : 'Pin to retain'}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/8 transition-colors text-left t-text"
                    onClick={e => { e.stopPropagation(); onToggleSensitive?.(node.id); setMenuOpen(false) }}
                  >
                    {node.sensitive ? <Unlock className="h-3 w-3 shrink-0" /> : <Lock className="h-3 w-3 shrink-0" />}
                    {node.sensitive ? 'Remove sensitive' : 'Mark as sensitive'}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/8 transition-colors text-left t-text"
                    onClick={e => { e.stopPropagation(); onToggleActive(node.id); setMenuOpen(false) }}
                  >
                    {node.active ? <Eye className="h-3 w-3 shrink-0" /> : <EyeOff className="h-3 w-3 shrink-0" />}
                    {node.active ? 'Hide from agent' : 'Show to agent'}
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/8 transition-colors text-left text-red-400"
                    onClick={e => { e.stopPropagation(); onDelete(node.id); setMenuOpen(false) }}
                  >
                    <Trash2 className="h-3 w-3 shrink-0" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: memory type + confidence dot */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('text-[10px] opacity-70',
            node.memoryType === 'episodic' ? 'text-violet-200' : 'text-teal-200')}>
            {node.memoryType}
          </span>
          <span className={cn('text-[10px] shrink-0', CONFIDENCE_COLORS[node.confidence])}>●</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
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
            <p className="text-[9px] t-muted mt-0.5">
              <span className="font-bold">R:</span> {decayLabel(decay)}
            </p>
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
