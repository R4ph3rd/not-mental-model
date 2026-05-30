import { useState } from 'react'
import { Eye, EyeOff, Pin, Edit2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NodeForm } from '@/components/NodeForm'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode } from '@/types/mental-model'
import { CATEGORY_COLORS, CATEGORY_LABELS, CONFIDENCE_COLORS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
import { CARD_W } from './layout'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode
  position: { x: number; y: number }
  selected: boolean
  onMouseDown: (e: React.MouseEvent, id: string) => void
  onDoubleClick: (id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onUpdate: (id: string, data: Partial<NodeFormData>) => void
  onDelete: (id: string) => void
}

export function CanvasNode({
  node, position, selected,
  onMouseDown, onDoubleClick,
  onToggleActive, onTogglePin,
  onUpdate, onDelete,
}: Props) {
  const [editing, setEditing] = useState(false)
  const decay = computeDecayScore(node)

  return (
    <>
      <div
        className={cn(
          'absolute group rounded-lg border flex flex-col transition-shadow',
          'bg-zinc-900 cursor-grab active:cursor-grabbing select-none',
          selected
            ? 'border-purple-500/70 shadow-[0_0_0_2px_rgba(139,92,246,0.25)]'
            : 'border-white/10 hover:border-white/20',
          !node.active && 'opacity-40',
        )}
        style={{ left: position.x, top: position.y, width: CARD_W }}
        onMouseDown={e => onMouseDown(e, node.id)}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick(node.id) }}
      >
        {/* Top controls — always visible */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', CATEGORY_COLORS[node.category])}>
              {CATEGORY_LABELS[node.category]}
            </span>
            <span className={cn('text-[10px]', CONFIDENCE_COLORS[node.confidence])}>●</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Pin — Xu 2025: retain against decay */}
            <button
              className={cn(
                'h-5 w-5 flex items-center justify-center rounded transition-colors',
                node.pinned ? 'text-amber-400' : 'text-white/20 hover:text-white/60'
              )}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onTogglePin(node.id) }}
              title={node.pinned ? 'Unpin (allow decay)' : 'Pin (retain always)'}
            >
              <Pin className="h-3 w-3" fill={node.pinned ? 'currentColor' : 'none'} />
            </button>
            {/* Eye toggle — Memory Sandbox: agent visibility */}
            <button
              className={cn(
                'h-5 w-5 flex items-center justify-center rounded transition-colors',
                node.active ? 'text-white/40 hover:text-white/80' : 'text-red-400 hover:text-red-300'
              )}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onToggleActive(node.id) }}
              title={node.active ? 'Hide from agent' : 'Show to agent'}
            >
              {node.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="px-3 pb-1">
          <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{node.title}</p>
        </div>

        {/* Content */}
        <div className="px-3 pb-2">
          <p className="text-[11px] text-white/50 leading-relaxed line-clamp-3">{node.content}</p>
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {node.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[9px] text-white/30 bg-white/5 border border-white/8 rounded px-1">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Memory type + scope */}
        <div className="px-3 pb-2 flex items-center gap-1.5 text-[9px] text-white/25">
          <span className={cn(
            'px-1 py-0.5 rounded border',
            node.memoryType === 'episodic'
              ? 'border-violet-500/30 text-violet-400/70'
              : 'border-teal-500/30 text-teal-400/70'
          )}>
            {node.memoryType}
          </span>
          {node.scope && <span className="text-white/20">· {node.scope}</span>}
        </div>

        {/* Decay bar — Xu 2025: visual retention strength */}
        <div className="mx-3 mb-2 h-0.5 rounded-full bg-white/5 overflow-hidden" title={`Retention: ${decayLabel(decay)}`}>
          <div className={cn('h-full rounded-full transition-all', decayBarColor(decay))} style={{ width: `${decay * 100}%` }} />
        </div>

        {/* Hover actions */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="h-5 w-5 flex items-center justify-center rounded bg-zinc-800 text-white/40 hover:text-white"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setEditing(true) }}
          >
            <Edit2 className="h-2.5 w-2.5" />
          </button>
          <button
            className="h-5 w-5 flex items-center justify-center rounded bg-zinc-800 text-white/40 hover:text-red-400"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(node.id) }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
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
