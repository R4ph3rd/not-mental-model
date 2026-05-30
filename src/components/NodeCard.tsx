import { useState, useRef } from 'react'
import { Eye, EyeOff, Pin, Edit2, Trash2, Link, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode } from '@/types/mental-model'
import { CATEGORY_LABELS, CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode
  linkedNodes: MentalModelNode[]
  selected: boolean
  onSelect: (id: string, multi: boolean) => void
  onUpdate: (id: string, data: Partial<NodeFormData>) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onEditRequest: (id: string) => void
}

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Inline-editable text field
function InlineText({
  value, onSave, tag = 'p', className,
}: {
  value: string
  onSave: (v: string) => void
  tag?: 'p' | 'h3'
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  function start(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function save() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim())
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKey}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        rows={tag === 'h3' ? 1 : 3}
        className={cn(
          'w-full rounded border t-border t-card t-text text-sm px-1 py-0.5 resize-none focus:outline-none focus:ring-1 focus:t-accent-ring',
          tag === 'h3' && 'font-semibold',
          className
        )}
      />
    )
  }

  return tag === 'h3'
    ? <h3 onDoubleClick={start} className={cn('cursor-text select-text', className)} title="Double-click to edit">{value}</h3>
    : <p onDoubleClick={start} className={cn('cursor-text select-text', className)} title="Double-click to edit">{value}</p>
}

export function NodeCard({
  node, linkedNodes, selected,
  onSelect, onUpdate, onDelete,
  onToggleActive, onTogglePin, onEditRequest,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isLong = node.content.length > 140
  const decay = computeDecayScore(node)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCardClick(e: React.MouseEvent) {
    const multi = e.ctrlKey || e.metaKey
    if (clickTimer.current) {
      // Second click of a double-click — cancel pending inspector open
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      onSelect(node.id, multi)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      onSelect(node.id, multi)
      if (!multi) onEditRequest(node.id)
    }, 220)
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border flex flex-col transition-all cursor-pointer',
        selected
          ? 't-accent-border t-accent-subtle ring-1 t-accent-ring'
          : 't-border t-card hover:border-white/20',
        !node.active && 'opacity-55',
      )}
      onClick={handleCardClick}
    >
      {/* Inactive badge */}
      {!node.active && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
          <span className="text-[10px] text-red-400/80 bg-black/60 px-2 py-0.5 rounded-full border border-red-500/20 backdrop-blur-sm">
            hidden from agent
          </span>
        </div>
      )}

      {/* ── Header row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        {/* Category + memory type */}
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium shrink-0', CATEGORY_COLORS[node.category])}>
          {CATEGORY_LABELS[node.category]}
        </span>
        <span className={cn('text-[10px] t-muted shrink-0',
          node.memoryType === 'episodic' ? 'text-violet-400/70' : 'text-teal-400/70')}>
          {node.memoryType}
        </span>
        {node.scope && (
          <span className="text-[10px] t-muted border t-border rounded px-1.5 truncate max-w-[80px]">{node.scope}</span>
        )}

        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {/* Pin — Xu 2025 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-6 w-6 flex items-center justify-center rounded transition-colors hover:t-card',
                  node.pinned ? 'text-amber-400' : 't-muted hover:t-text')}
                onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
              >
                <Pin className="h-3.5 w-3.5" fill={node.pinned ? 'currentColor' : 'none'} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.pinned ? 'Unpin (allow decay)' : 'Pin — retains at full strength'}</TooltipContent>
          </Tooltip>

          {/* Visibility — Memory Sandbox */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn('h-6 w-6 flex items-center justify-center rounded transition-colors',
                  node.active ? 't-muted hover:t-text' : 'text-red-400 hover:text-red-300')}
                onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
              >
                {node.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{node.active ? 'Hide from agent' : 'Show to agent'}</TooltipContent>
          </Tooltip>

          {/* Edit */}
          <button
            className="h-6 w-6 flex items-center justify-center rounded t-muted hover:t-text transition-colors"
            onClick={e => { e.stopPropagation(); onEditRequest(node.id) }}
            title="Edit node"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>

          {/* Delete */}
          <button
            className="h-6 w-6 flex items-center justify-center rounded t-muted hover:text-red-400 transition-colors"
            onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            title="Delete node"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Title (double-click to edit inline) ────────────────── */}
      <div className="px-3 pb-1">
        <div className="flex items-start gap-2">
          <InlineText
            tag="h3"
            value={node.title}
            onSave={v => onUpdate(node.id, { title: v })}
            className="text-sm font-semibold t-text leading-snug flex-1"
          />
          <span className={cn('text-xs shrink-0 mt-0.5', CONFIDENCE_COLORS[node.confidence])}>●</span>
        </div>
      </div>

      {/* ── Content (double-click to edit inline) ──────────────── */}
      <div className="px-3 pb-2">
        {isLong && !expanded ? (
          <>
            <p className="text-xs t-muted leading-relaxed">
              {node.content.slice(0, 140)}…
            </p>
            <button
              className="text-xs t-accent mt-1 flex items-center gap-0.5 hover:underline"
              onClick={e => { e.stopPropagation(); setExpanded(true) }}
            >
              <ChevronDown className="h-3 w-3" />More
            </button>
          </>
        ) : (
          <>
            <InlineText
              value={node.content}
              onSave={v => onUpdate(node.id, { content: v })}
              className="text-xs t-muted leading-relaxed"
            />
            {isLong && (
              <button
                className="text-xs t-accent mt-1 flex items-center gap-0.5 hover:underline"
                onClick={e => { e.stopPropagation(); setExpanded(false) }}
              >
                <ChevronUp className="h-3 w-3" />Less
              </button>
            )}
          </>
        )}
      </div>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {node.tags.map(t => (
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 t-card border t-border t-muted">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {/* Linked nodes */}
      {linkedNodes.length > 0 && (
        <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
          <Link className="h-3 w-3 t-muted shrink-0" />
          {linkedNodes.map(ln => (
            <span key={ln.id} className="text-[10px] t-muted border t-border rounded px-1.5 py-0.5 t-card">
              {ln.title}
            </span>
          ))}
        </div>
      )}

      {/* ── Decay bar — Xu 2025 ─────────────────────────────────── */}
      <div className="px-3 pb-3 mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 mb-1.5 cursor-help">
              <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', decayBarColor(decay))}
                  style={{ width: `${decay * 100}%` }} />
              </div>
              <span className="text-[10px] t-muted tabular-nums w-10 text-right">
                {decayLabel(decay)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="font-medium mb-1">Retention strength: {Math.round(decay * 100)}%</p>
            <p className="text-[11px] t-muted leading-relaxed">
              Recency × 0.4 + Importance × 0.35 + Confidence × 0.25. Pinned nodes stay at 100%.
              Fading nodes may be pruned by the agent.
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2 text-[10px] t-muted">
          {node.source && <span>via {node.source}</span>}
          <span>·</span>
          <span>{relativeTime(node.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}
