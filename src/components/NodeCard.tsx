import { useState } from 'react'
import { Edit2, Trash2, Link, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NodeForm } from './NodeForm'
import type { MentalModelNode } from '@/types/mental-model'
import { CATEGORY_LABELS, CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'

interface Props {
  node: MentalModelNode
  linkedNodes: MentalModelNode[]
  onUpdate: (id: string, data: Partial<NodeFormData>) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  selected: boolean
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NodeCard({ node, linkedNodes, onUpdate, onDelete, onSelect, selected }: Props) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isLong = node.content.length > 120

  return (
    <>
      <div
        className={`group relative rounded-lg border p-4 transition-all cursor-pointer ${
          selected
            ? 'border-purple-500/60 bg-purple-500/5 ring-1 ring-purple-500/30'
            : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
        }`}
        onClick={() => onSelect(node.id)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${CATEGORY_COLORS[node.category]}`}>
              {CATEGORY_LABELS[node.category]}
            </span>
            <span className={`text-xs font-medium ${CONFIDENCE_COLORS[node.confidence]}`}>
              ● {node.confidence}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={e => { e.stopPropagation(); setEditing(true) }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:text-red-400"
              onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white mb-1.5 leading-snug">{node.title}</h3>

        {/* Content */}
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

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {node.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Links */}
        {linkedNodes.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <Link className="h-3 w-3 text-white/30" />
            {linkedNodes.map(ln => (
              <span key={ln.id} className="text-[10px] text-white/40 bg-white/5 rounded px-1.5 py-0.5 border border-white/8">
                {ln.title}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2.5 flex items-center gap-2 text-[10px] text-white/25">
          {node.source && <span>via {node.source}</span>}
          <span>·</span>
          <span>{relativeTime(node.updatedAt)}</span>
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
