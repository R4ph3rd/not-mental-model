import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, Check } from 'lucide-react'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'

interface Props {
  node?: MentalModelNode
  onSubmit: (data: NodeFormData) => void
  onCancel: () => void
  extraActions?: React.ReactNode
  hideTitle?: boolean
}

const CATEGORIES   = Object.entries(CATEGORY_LABELS) as [NodeCategory, string][]
const SCOPES   = ['', 'Work', 'Personal', 'Skills', 'Goals', 'Research', 'Side projects']

const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const MEMORY_TYPE_OPTIONS: { value: MemoryType; label: string }[] = [
  { value: 'semantic', label: 'Semantic' },
  { value: 'episodic', label: 'Episodic' },
]

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '',                label: 'Unknown' },
  { value: 'direct',         label: 'Direct' },
  { value: 'conversation',   label: 'Conversation' },
  { value: 'observed',       label: 'Observed' },
  { value: 'inferred',       label: 'Inferred' },
  { value: 'claude.ai',      label: 'claude.ai' },
  { value: 'chatgpt',        label: 'ChatGPT' },
  { value: 'claude-summary', label: 'Summary' },
]

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-widest t-muted mb-1.5">{children}</label>
}

// ─── PillSelect ────────────────────────────────────────────────────────────────

interface PillOption<T extends string> { value: T; label: string }

interface PillSelectProps<T extends string> {
  value: T
  options: PillOption<T>[]
  onChange: (v: T) => void
}

export function PillSelect<T extends string>({ value, options, onChange }: PillSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border t-border bg-white/[0.04] t-text hover:bg-white/[0.08] transition-colors"
      >
        {current.label}
        <ChevronDown className="h-3 w-3 t-muted" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[130px] rounded-lg border t-border t-sidebar shadow-xl overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] t-text hover:bg-white/[0.06] transition-colors"
            >
              <span className="w-3 shrink-0">
                {opt.value === value && <Check className="h-3 w-3 t-accent" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

export function NodeForm({ node, onSubmit, onCancel, extraActions, hideTitle }: Props) {
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
    if (!hideTitle && !title.trim()) return
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
          <PillSelect value={memoryType} options={MEMORY_TYPE_OPTIONS} onChange={setMemoryType} />
        </div>
      </div>

      {/* Title */}
      {!hideTitle && (
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Short, descriptive label" autoFocus />
        </div>
      )}

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
          <PillSelect value={confidence} options={CONFIDENCE_OPTIONS} onChange={setConfidence} />
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
          <PillSelect value={source} options={SOURCE_OPTIONS} onChange={setSource} />
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
          <Button type="submit" size="sm" disabled={!hideTitle && !title.trim()}>
            {node ? 'Save changes' : 'Add node'}
          </Button>
        </div>
      </div>
    </form>
  )
}
