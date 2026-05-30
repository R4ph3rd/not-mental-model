import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'

interface Props {
  node?: MentalModelNode
  onSubmit: (data: NodeFormData) => void
  onCancel: () => void
  extraActions?: React.ReactNode
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [NodeCategory, string][]
const CONFIDENCES: [ConfidenceLevel, string][] = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]
const MEMORY_TYPES: [MemoryType, string][] = [
  ['semantic', 'Semantic — abstracted fact'],
  ['episodic', 'Episodic — specific event'],
]

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-widest t-muted mb-1.5">{children}</label>
}

export function NodeForm({ node, onSubmit, onCancel, extraActions }: Props) {
  const [category, setCategory]   = useState<NodeCategory>(node?.category ?? 'fact')
  const [title, setTitle]         = useState(node?.title ?? '')
  const [content, setContent]     = useState(node?.content ?? '')
  const [tags, setTags]           = useState(node?.tags.join(', ') ?? '')
  const [confidence, setConfidence] = useState<ConfidenceLevel>(node?.confidence ?? 'medium')
  const [source, setSource]       = useState(node?.source ?? '')
  const [memoryType, setMemoryType] = useState<MemoryType>(node?.memoryType ?? 'semantic')
  const [scope, setScope]         = useState(node?.scope ?? '')
  const [importance, setImportance] = useState(node?.importance ?? 0.8)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      category, confidence, memoryType,
      title:   title.trim(),
      content: content.trim(),
      tags:    tags.split(',').map(t => t.trim()).filter(Boolean),
      source:  source.trim(),
      scope:   scope.trim(),
      importance,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as NodeCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Confidence</Label>
          <Select value={confidence} onValueChange={v => setConfidence(v as ConfidenceLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONFIDENCES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Memory type</Label>
        <Select value={memoryType} onValueChange={v => setMemoryType(v as MemoryType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEMORY_TYPES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short, descriptive label" autoFocus />
      </div>

      <div>
        <Label>Content</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="What the AI knows or believes about the user" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tags (comma-separated)</Label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="react, ai, design" />
        </div>
        <div>
          <Label>Scope</Label>
          <Input value={scope} onChange={e => setScope(e.target.value)} placeholder="Work / Personal…" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Source</Label>
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder="conversation / inferred…" />
        </div>
        <div>
          <Label>
            <span className="flex justify-between">
              <span>Importance</span>
              <span>{Math.round(importance * 100)}%</span>
            </span>
          </Label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={importance}
            onChange={e => setImportance(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer mt-2.5"
            style={{ accentColor: 'hsl(var(--p-h) var(--p-s) var(--p-l))' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {extraActions}
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!title.trim()}>
            {node ? 'Save changes' : 'Add node'}
          </Button>
        </div>
      </div>
    </form>
  )
}
