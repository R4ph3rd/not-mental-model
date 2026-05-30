import { useState } from 'react'
import { Eye, EyeOff, Pin, Edit2, Trash2, Link, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NodeForm } from './NodeForm'
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
}

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NodeCard({ node, linkedNodes, selected, onSelect, onUpdate, onDelete, onToggleActive, onTogglePin }: Props) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isLong = node.content.length > 120
  const decay = computeDecayScore(node)

  return (
    <>
      <div
        className={cn(
          'group relative rounded-lg border flex flex-col transition-all cursor-pointer',
          selected
            ? 'border-purple-500/60 bg-purple-500/5 ring-1 ring-purple-500/30'
            : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5',
          !node.active && 'opacity-50',
        )}
        onClick={e => onSelect(node.id, e.ctrlKey || e.metaKey)}
      >
        {/* Inactive indicator */}
        {!node.active && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none z-10">
            <span className="text-[10px] text-red-400/70 bg-zinc-950/80 px-2 py-0.5 rounded border border-red-500/20">
              hidden from agent
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-md border font-medium', CATEGORY_COLORS[node.category])}>
              {CATEGORY_LABELS[node.category]}
            </span>
            <span className={cn('text-xs', node.memoryType === 'episodic' ? 'text-violet-400/60' : 'text-teal-400/60')}>
              {node.memoryType}
            </span>
            {node.scope && (
              <span className="text-[10px] text-white/25 bg-white/5 border border-white/8 rounded px-1.5">
                {node.scope}
              </span>
            )}
          </div>

          {/* Active toggle (Memory Sandbox) + pin (Xu 2025) — always visible */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded transition-colors',
                node.pinned ? 'text-amber-400' : 'text-white/20 hover:text-white/60'
              )}
              onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
              title={node.pinned ? 'Unpin' : 'Pin to retain'}
            >
              <Pin className="h-3 w-3" fill={node.pinned ? 'currentColor' : 'none'} />
            </button>
            <button
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded transition-colors',
                node.active ? 'text-white/30 hover:text-white/70' : 'text-red-400 hover:text-red-300'
              )}
              onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
              title={node.active ? 'Hide from agent' : 'Show to agent'}
            >
              {node.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Title + confidence */}
        <div className="px-4 pb-1.5 flex items-start gap-2">
          <h3 className="text-sm font-semibold text-white leading-snug flex-1">{node.title}</h3>
          <span className={cn('text-xs shrink-0 mt-0.5', CONFIDENCE_COLORS[node.confidence])}>●</span>
        </div>

        {/* Content */}
        <div className="px-4 pb-2">
          <p className="text-xs text-white/60 leading-relaxed">
            {isLong && !expanded ? node.content.slice(0, 120) + '…' : node.content}
          </p>
          {isLong && (
            <button
              className="text-xs text-purple-400 mt-1 flex items-center gap-0.5 hover:text-purple-300"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            >
              {expanded ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />More</>}
            </button>
          )}
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1">
            {node.tags.map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">#{t}</Badge>
            ))}
          </div>
        )}

        {/* Links */}
        {linkedNodes.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
            <Link className="h-3 w-3 text-white/25" />
            {linkedNodes.map(ln => (
              <span key={ln.id} className="text-[10px] text-white/35 bg-white/5 rounded px-1.5 py-0.5 border border-white/8">
                {ln.title}
              </span>
            ))}
          </div>
        )}

        {/* Footer: decay bar + meta */}
        <div className="px-4 pb-3 mt-auto">
          {/* Decay bar — Xu 2025 */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div className={cn('h-full rounded-full', decayBarColor(decay))} style={{ width: `${decay * 100}%` }} />
            </div>
            <span className="text-[10px] text-white/25 tabular-nums">{decayLabel(decay)}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/20">
            {node.source && <span>via {node.source}</span>}
            <span>·</span>
            <span>{relativeTime(node.updatedAt)}</span>
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute top-2 right-16 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon" variant="ghost" className="h-6 w-6"
            onClick={e => { e.stopPropagation(); setEditing(true) }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-6 w-6 hover:text-red-400"
            onClick={e => { e.stopPropagation(); onDelete(node.id) }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <NodeForm
            node={node}
            onSubmit={data => { onUpdate(node.id, data); setEditing(false) }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
