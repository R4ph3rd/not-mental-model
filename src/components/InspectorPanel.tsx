import { useState } from 'react'
import { X, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NodeForm } from '@/components/NodeForm'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/types/mental-model'
import type { MentalModelNode, Conversation } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode | null
  conversations: Conversation[]
  onClose: () => void
  onUpdate: (id: string, data: Partial<NodeFormData> & { conversationIds?: string[] }) => void
  onDelete: (id: string) => void
}

export function InspectorPanel({ node, conversations, onClose, onUpdate, onDelete }: Props) {
  const [showConvPicker, setShowConvPicker] = useState(false)
  if (!node) return null
  const n = node  // narrowed non-null ref for use in closures

  const nodeConvs = conversations.filter(c => (n.conversationIds ?? []).includes(c.id))
  const availableConvs = conversations.filter(c => !(n.conversationIds ?? []).includes(c.id))

  function addConv(convId: string) {
    onUpdate(n.id, { conversationIds: [...(n.conversationIds ?? []), convId] })
    setShowConvPicker(false)
  }

  function removeConv(convId: string) {
    onUpdate(n.id, { conversationIds: (n.conversationIds ?? []).filter(id => id !== convId) })
  }

  return (
    <div className="w-80 shrink-0 border-l t-border t-sidebar flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b t-border shrink-0">
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium', CATEGORY_COLORS[node.category])}>
          {CATEGORY_LABELS[node.category]}
        </span>
        <span className="flex-1 text-sm font-medium t-text truncate">{node.title}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <NodeForm
          node={node}
          onSubmit={data => { onUpdate(node.id, data); onClose() }}
          onCancel={onClose}
          extraActions={
            <Button type="button" variant="destructive" size="sm"
              onClick={() => { onDelete(node.id); onClose() }}>
              Delete node
            </Button>
          }
        />

        {/* Memory Sandbox: cross-conversation sharing */}
        <div className="border-t t-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium t-text flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 t-muted" />
              In conversations
            </p>
            {availableConvs.length > 0 && (
              <button onClick={() => setShowConvPicker(v => !v)}
                className="text-[10px] t-accent hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>

          {nodeConvs.length === 0 && !showConvPicker && (
            <p className="text-[11px] t-muted">Not linked to any conversation.</p>
          )}

          <div className="space-y-1">
            {nodeConvs.map(conv => (
              <div key={conv.id} className="flex items-center gap-1.5 rounded-lg t-card border t-border px-2.5 py-1.5">
                <MessageSquare className="h-3 w-3 t-muted shrink-0" />
                <span className="text-[11px] t-text flex-1 truncate">{conv.title}</span>
                <button onClick={() => removeConv(conv.id)}
                  className="t-muted hover:text-red-400 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Conversation picker for cross-conv sharing — Memory Sandbox */}
          {showConvPicker && availableConvs.length > 0 && (
            <div className="rounded-lg border t-border t-card overflow-hidden">
              <p className="text-[10px] t-muted px-2.5 pt-2 pb-1 uppercase tracking-wider">Add to conversation</p>
              {availableConvs.map(conv => (
                <button key={conv.id} onClick={() => addConv(conv.id)}
                  className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:t-accent-subtle transition-colors">
                  <MessageSquare className="h-3 w-3 t-muted shrink-0" />
                  <span className="text-[11px] t-text truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
