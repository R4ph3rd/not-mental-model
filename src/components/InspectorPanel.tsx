import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NodeForm } from '@/components/NodeForm'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/types/mental-model'
import type { MentalModelNode } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode | null
  onClose: () => void
  onUpdate: (id: string, data: Partial<NodeFormData>) => void
  onDelete: (id: string) => void
}

export function InspectorPanel({ node, onClose, onUpdate, onDelete }: Props) {
  if (!node) return null

  return (
    <div className="w-80 shrink-0 border-l t-border t-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b t-border shrink-0">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium', CATEGORY_COLORS[node.category])}>
          {CATEGORY_LABELS[node.category]}
        </span>
        <span className="flex-1 text-sm font-medium t-text truncate">{node.title}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-4">
        <NodeForm
          node={node}
          onSubmit={data => { onUpdate(node.id, data); onClose() }}
          onCancel={onClose}
          extraActions={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => { onDelete(node.id); onClose() }}
            >
              Delete node
            </Button>
          }
        />
      </div>
    </div>
  )
}
