import { useState, useRef } from 'react'
import {
  Eye, EyeOff, Pin, Trash2, Link, ChevronDown, ChevronUp,
  Lock, Unlock, Bot, Sparkles, Check, ArrowUpCircle, X,
  Briefcase, MessageSquare, BookOpen, Heart, Target, Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode, NodeCategory } from '@/types/mental-model'
import { CATEGORY_LABELS, CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
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
  linkedNodes: MentalModelNode[]
  selected: boolean
  onSelect: (id: string, multi: boolean) => void
  onUpdate: (id: string, data: Partial<NodeFormData> & { conversationIds?: string[] }) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onConfirm: (id: string) => void
  onEditRequest: (id: string) => void
  onDistill?: (node: MentalModelNode) => void
}

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function InlineText({ value, onSave, tag = 'p', className }: {
  value: string; onSave: (v: string) => void; tag?: 'p' | 'h3'; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(value); setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }
  // Single-click on text: stop propagation so the card's onClick (open inspector) doesn't fire.
  // Ctrl/Cmd+click still propagates so multi-select works.
  function handleClick(e: React.MouseEvent) {
    if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
  }
  function save() { setEditing(false); if (draft.trim() && draft.trim() !== value) onSave(draft.trim()) }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
  }

  if (editing) {
    return (
      <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save} onKeyDown={onKey}
        onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
        rows={tag === 'h3' ? 1 : 3}
        className={cn('w-full rounded border t-border t-card t-text text-sm px-1 py-0.5 resize-none focus:outline-none', tag === 'h3' && 'font-semibold', className)}
      />
    )
  }
  return tag === 'h3'
    ? <h3 onClick={handleClick} onDoubleClick={startEdit}
        className={cn('cursor-text select-text', className)}
        title="Double-click to edit inline">{value}</h3>
    : <p onClick={handleClick} onDoubleClick={startEdit}
        className={cn('cursor-text select-text', className)}
        title="Double-click to edit inline">{value}</p>
}

export function NodeCard({
  node, linkedNodes, selected,
  onSelect, onUpdate, onDelete,
  onToggleActive, onTogglePin, onConfirm, onEditRequest, onDistill,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isLong = node.content.length > 140
  const decay = computeDecayScore(node)

  const isUnconfirmedAgent = node.provenance === 'agent' && !node.confirmed
  const canDistill = onDistill && node.memoryType === 'episodic' && decay < 0.5 && !node.pinned

  // Single click on card body (not on InlineText — those stop propagation) → select + open inspector.
  function handleCardClick(e: React.MouseEvent) {
    const multi = e.ctrlKey || e.metaKey
    onSelect(node.id, multi)
    if (!multi) onEditRequest(node.id)
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group relative rounded-xl border flex flex-col transition-all cursor-pointer overflow-hidden',
        selected ? 't-accent-border t-accent-subtle ring-1 t-accent-ring' : 't-border t-card hover:border-white/20',
        !node.active && 'opacity-55',
        isUnconfirmedAgent ? 'border-l-2 border-l-amber-400/70 hover:border-l-amber-400/70'
          : (node.conversationIds?.length ?? 0) > 0 && 'border-l-2 border-l-violet-400/50',
      )}
    >
      {/* Hidden-from-agent overlay */}
      {!node.active && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-10">
          <span className="text-[10px] text-red-400/80 bg-black/60 px-2 py-0.5 rounded-full border border-red-500/20 backdrop-blur-sm">
            hidden from agent
          </span>
        </div>
      )}

      {/* ── Colored category bar ─────────────────────────────── */}
      <div className={cn('flex flex-col px-3 py-1.5 border-b', CATEGORY_COLORS[node.category])}>
        {/* Row 1: icon + title */}
        <div className="flex items-start gap-1.5 pr-5 relative">
          <span className="shrink-0 mt-0.5">{CATEGORY_ICONS[node.category]}</span>
          <InlineText tag="h3" value={node.title} onSave={v => onUpdate(node.id, { title: v })}
            className="text-[11px] font-semibold leading-snug flex-1 min-w-0 break-words" />
        </div>

        {/* Row 2: category label + memoryType + confidence + provenance + actions */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-semibold opacity-80">{CATEGORY_LABELS[node.category]}</span>
          <span className={cn('text-[10px] opacity-70',
            node.memoryType === 'episodic' ? 'text-violet-200' : 'text-teal-200')}>
            {node.memoryType}
          </span>
          <span className={cn('text-[10px]', CONFIDENCE_COLORS[node.confidence])}>●</span>

          {node.provenance === 'agent' && (
            <span className={cn('text-[10px] flex items-center gap-0.5',
              node.confirmed ? 'opacity-60' : 'text-amber-300')}>
              <Bot className="h-2.5 w-2.5" />
              {!node.confirmed && 'unconfirmed'}
            </span>
          )}
          {node.provenance === 'extracted' && (
            <span className="text-[10px] opacity-60 flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          )}

          {/* Action buttons — slide in from right on hover */}
          <div className="flex items-center gap-0 ml-auto translate-x-1 group-hover:translate-x-0 transition-transform duration-150">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn('h-5 w-5 flex items-center justify-center rounded transition-all duration-150',
                    node.sensitive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                  onClick={e => { e.stopPropagation(); onUpdate(node.id, { sensitive: !node.sensitive }) }}
                >
                  {node.sensitive ? <Lock className="h-3 w-3 [&_rect]:fill-current [&_path]:fill-none [&_path]:[stroke-width:2.5]" /> : <Unlock className="h-3 w-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{node.sensitive ? 'Sensitive — excluded from context' : 'Mark as sensitive'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn('h-5 w-5 flex items-center justify-center rounded transition-all duration-150',
                    node.pinned ? 'text-amber-300 opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                  onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
                >
                  <Pin className="h-3 w-3" fill={node.pinned ? 'currentColor' : 'none'} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{node.pinned ? 'Unpin' : 'Pin (prevent decay)'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn('h-5 w-5 flex items-center justify-center rounded transition-all duration-150',
                    !node.active ? 'text-red-300 opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100')}
                  onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
                >
                  {node.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{node.active ? 'Hide from agent' : 'Show to agent'}</TooltipContent>
            </Tooltip>

            <button
              className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:text-red-300 hover:!opacity-100 transition-all duration-150"
              onClick={e => { e.stopPropagation(); onDelete(node.id) }}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="px-3 pb-2">
        {isLong && !expanded ? (
          <>
            <p className="text-xs t-muted leading-relaxed">{node.content.slice(0, 140)}…</p>
            <button className="text-xs t-accent mt-1 flex items-center gap-0.5 hover:underline"
              onClick={e => { e.stopPropagation(); setExpanded(true) }}>
              <ChevronDown className="h-3 w-3" />More
            </button>
          </>
        ) : (
          <>
            <InlineText value={node.content} onSave={v => onUpdate(node.id, { content: v })}
              className="text-xs t-muted leading-relaxed" />
            {isLong && (
              <button className="text-xs t-accent mt-1 flex items-center gap-0.5 hover:underline"
                onClick={e => { e.stopPropagation(); setExpanded(false) }}>
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
            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 t-card border t-border t-muted">#{t}</Badge>
          ))}
        </div>
      )}

      {/* Linked nodes */}
      {linkedNodes.length > 0 && (
        <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
          <Link className="h-3 w-3 t-muted shrink-0" />
          {linkedNodes.map(ln => (
            <span key={ln.id} className="text-[10px] t-muted border t-border rounded-full px-2 py-0.5 t-card">{ln.title}</span>
          ))}
        </div>
      )}

      {/* Governance: confirm strip for unconfirmed agent nodes */}
      {isUnconfirmedAgent && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
          <Bot className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300/90 flex-1">Agent extracted this — confirm to keep.</p>
          <button onClick={e => { e.stopPropagation(); onConfirm(node.id) }}
            className="flex items-center gap-0.5 text-[10px] text-green-400 hover:text-green-300 shrink-0">
            <Check className="h-3 w-3" />Keep
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            className="flex items-center gap-0.5 text-[10px] text-red-400 hover:text-red-300 shrink-0">
            <X className="h-3 w-3" />Discard
          </button>
        </div>
      )}

      {/* ── Decay bar ───────────────────────────────────────────── */}
      <div className="px-3 pb-3 mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 mb-1.5 cursor-help">
              <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', decayBarColor(decay))}
                  style={{ width: `${decay * 100}%` }} />
              </div>
              <span className="text-[10px] t-muted tabular-nums shrink-0">
                <span className="font-bold">R:</span> {decayLabel(decay)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="font-medium mb-1">Retention: {Math.round(decay * 100)}%</p>
            <p className="text-[11px] t-muted">Recency × 0.4 + Importance × 0.35 + Confidence × 0.25</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] t-muted">
            {node.source && <span>via {node.source}</span>}
            <span>·</span>
            <span>{relativeTime(node.updatedAt)}</span>
          </div>

          {canDistill && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={e => { e.stopPropagation(); onDistill!(node) }}
                  className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                  <ArrowUpCircle className="h-3 w-3" />Distill →
                </button>
              </TooltipTrigger>
              <TooltipContent>Distil fading episodic memory into a lasting semantic fact (AI)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
