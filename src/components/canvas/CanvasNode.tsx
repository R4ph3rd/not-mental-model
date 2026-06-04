import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Pin, Trash2, LockKeyhole, Unlock, Briefcase, MessageSquare, BookOpen, Heart, Target, Zap, MoreVertical, Bot } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode, NodeCategory } from '@/types/mental-model'
import { CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
import { CARD_W } from './layout'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<NodeCategory, React.ReactNode> = {
  project:      <Briefcase className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
  conversation: <MessageSquare className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
  fact:         <BookOpen className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
  preference:   <Heart className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
  goal:         <Target className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
  skill:        <Zap className="h-3 w-3 [&_*]:fill-current [&_*]:[stroke:none]" />,
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
  onUpdate?: (id: string, data: { title?: string }) => void
  onConfirm?: (id: string) => void
  onDiscard?: (id: string) => void
}

export function CanvasNode({
  node, position, selected, groupColor,
  onMouseDown, onToggleActive, onTogglePin, onToggleSensitive, onDelete, onUpdate, onConfirm, onDiscard,
}: Props) {
  const decay = computeDecayScore(node)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const isUnconfirmed = node.provenance === 'agent' && !node.confirmed
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click — uses document listener to avoid z-index/transform issues
  useEffect(() => {
    if (!menuOpen) return
    function close(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== node.title) onUpdate?.(node.id, { title: trimmed })
    else setTitleDraft(node.title)
  }

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
    >
      {/* Colored title bar */}
      <div className={cn('relative flex flex-col px-3 py-1.5 border-b shrink-0', CATEGORY_COLORS[node.category])}>
        {/* Row 1: category icon + wrappable title (pr-5 to leave room for 3-dots) */}
        <div className="flex items-start gap-1.5 pr-5">
          <span className="shrink-0 mt-0.5">{CATEGORY_ICONS[node.category]}</span>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(node.title) }
              }}
              onMouseDown={e => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent text-[11px] font-semibold leading-snug outline-none border-b border-white/40"
            />
          ) : (
            <span
              className="text-[11px] font-semibold leading-snug flex-1 min-w-0 break-words cursor-text"
              onDoubleClick={e => { e.stopPropagation(); setTitleDraft(node.title); setEditingTitle(true) }}
            >
              {node.title}
            </span>
          )}
        </div>

        {/* Absolute 3-dots at top-right with bg to cover text behind it */}
        <div ref={menuRef} className="absolute top-1 right-1.5 z-10">
          <button
            className="h-5 w-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          >
            <MoreVertical className="h-3 w-3" />
          </button>

          {menuOpen && (
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
                {node.sensitive ? <Unlock className="h-3 w-3 shrink-0" /> : <LockKeyhole className="h-3 w-3 shrink-0" />}
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
          )}
        </div>

        {/* Row 2: memory type + confidence dot + right-aligned active status icons */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={cn('text-[10px] opacity-70',
            node.memoryType === 'episodic' ? 'text-violet-200' : 'text-teal-200')}>
            {node.memoryType}
          </span>
          <span className={cn('text-[10px] shrink-0', CONFIDENCE_COLORS[node.confidence])}>●</span>

          <div className="flex-1" />

          {/* Active-state status icons (right-aligned) */}
          <div className="flex items-center gap-0.5">
            {isUnconfirmed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-4 w-4 flex items-center justify-center rounded text-amber-400"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    <Bot className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[180px] p-2">
                  <p className="text-[11px] mb-1.5">Agent extracted this — confirm to keep.</p>
                  <div className="flex gap-1">
                    <button
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-green-500/40 text-green-300 hover:bg-green-500/10 transition-colors"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); onConfirm?.(node.id) }}
                    >Keep</button>
                    <button
                      className="flex-1 text-[10px] px-2 py-0.5 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); onDiscard?.(node.id) }}
                    >Discard</button>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {node.pinned && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-4 w-4 flex items-center justify-center rounded text-amber-300"
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
                    className="h-4 w-4 flex items-center justify-center rounded text-orange-300"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onToggleSensitive?.(node.id) }}
                  >
                    <LockKeyhole className="h-3 w-3" fill="currentColor" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sensitive — click to remove</TooltipContent>
              </Tooltip>
            )}
            {!node.active && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-4 w-4 flex items-center justify-center rounded text-red-300"
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
