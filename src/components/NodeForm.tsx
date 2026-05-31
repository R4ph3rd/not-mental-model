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

const CATEGORIES   = Object.entries(CATEGORY_LABELS) as [NodeCategory, string][]
const CONFIDENCES: [ConfidenceLevel, string][] = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]
const MEMORY_TYPES: [MemoryType, string][] = [
  ['semantic',  'Semantic — abstracted fact'],
  ['episodic',  'Episodic — specific event'],
]
const SCOPES   = ['', 'Work', 'Personal', 'Skills', 'Goals', 'Research', 'Side projects']
const SOURCES  = ['', 'direct', 'conversation', 'observed', 'inferred', 'claude.ai', 'chatgpt', 'claude-summary']

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-widest t-muted mb-1.5">{children}</label>
}

export function NodeForm({ node, onSubmit, onCancel, extraActions }: Props) {
  const [category,   setCategory]   = useState<NodeCategory>(node?.category ?? 'fact')
  const [title,      setTitle]      = useState(node?.title ?? '')
  const [content,    setContent]    = useState(node?.content ?? '')
  const [tags,       setTags]       = useState(node?.tags.join(', ') ?? '')
  const [confidence, setConfidence] = useState<ConfidenceLevel>(node?.confidence ?? 'medium')
  const [source,     setSource]     = useState(node?.source ?? '')
  const [memoryType, setMemoryType] = useState<MemoryType>(node?.memoryType ?? 'semantic')
  const [scope,      setScope]      = useState(node?.scope ?? '')
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
      {/* Category + Memory type */}
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
          <Label>Memory type</Label>
          <Select value={memoryType} onValueChange={v => setMemoryType(v as MemoryType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEMORY_TYPES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Title */}
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Short, descriptive label" autoFocus />
      </div>

      {/* Content — expandable */}
      <div>
        <Label>Content</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="What the AI knows or believes about the user"
          rows={6} className="resize-y min-h-[120px]" />
      </div>

      {/* Tags — own row */}
      <div>
        <Label>Tags (comma-separated)</Label>
        <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="react, ai, design" />
        {tags.trim() && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border t-border t-card t-muted">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Confidence + Scope */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Confidence</Label>
          <Select value={confidence} onValueChange={v => setConfidence(v as ConfidenceLevel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONFIDENCES.map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scope</Label>
          <Select value={scope || '_none'} onValueChange={v => setScope(v === '_none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {SCOPES.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Source + Importance */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Source</Label>
          <Select value={source || '_none'} onValueChange={v => setSource(v === '_none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {SOURCES.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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
            className="w-full mt-2.5 cursor-pointer
              [&::-webkit-slider-runnable-track]:h-1.5
              [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-runnable-track]:bg-white/15
              [&::-moz-range-track]:h-1.5
              [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:bg-white/15"
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
