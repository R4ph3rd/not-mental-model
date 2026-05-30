import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'

interface Props {
  node?: MentalModelNode
  onSubmit: (data: NodeFormData) => void
  onCancel: () => void
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [NodeCategory, string][]
const CONFIDENCES: [ConfidenceLevel, string][] = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]
const MEMORY_TYPES: [MemoryType, string][] = [['semantic', 'Semantic — abstracted fact'], ['episodic', 'Episodic — specific event']]

export function NodeForm({ node, onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState<NodeCategory>(node?.category ?? 'fact')
  const [title, setTitle] = useState(node?.title ?? '')
  const [content, setContent] = useState(node?.content ?? '')
  const [tags, setTags] = useState(node?.tags.join(', ') ?? '')
  const [confidence, setConfidence] = useState<ConfidenceLevel>(node?.confidence ?? 'medium')
  const [source, setSource] = useState(node?.source ?? '')
  const [memoryType, setMemoryType] = useState<MemoryType>(node?.memoryType ?? 'semantic')
  const [scope, setScope] = useState(node?.scope ?? '')
  const [importance, setImportance] = useState(node?.importance ?? 0.8)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      confidence,
      source: source.trim(),
      memoryType,
      scope: scope.trim(),
      importance,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{node ? 'Edit node' : 'Add node'}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide">Category</label>
          <Select value={category} onValueChange={v => setCategory(v as NodeCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide">Confidence</label>
          <Select value={confidence} onValueChange={v => setConfidence(v as ConfidenceLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONFIDENCES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Xu 2025: episodic vs semantic distinction */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Memory type</label>
        <Select value={memoryType} onValueChange={v => setMemoryType(v as MemoryType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEMORY_TYPES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Title</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short, descriptive label" autoFocus />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Content</label>
        <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What the AI knows or believes" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide">Tags (comma-separated)</label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="react, ai, design" />
        </div>
        {/* CHI 2025: project/domain scope */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide">Scope</label>
          <Input value={scope} onChange={e => setScope(e.target.value)} placeholder="Work / Personal / Health…" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide">Source</label>
          <Input value={source} onChange={e => setSource(e.target.value)} placeholder="conversation / observed / inferred" />
        </div>
        {/* Xu 2025: user-specified utility weight */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wide flex justify-between">
            <span>Importance</span>
            <span className="text-white/30">{Math.round(importance * 100)}%</span>
          </label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={importance}
            onChange={e => setImportance(Number(e.target.value))}
            className="w-full accent-purple-500 h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!title.trim()}>{node ? 'Save changes' : 'Add node'}</Button>
      </div>
    </form>
  )
}
