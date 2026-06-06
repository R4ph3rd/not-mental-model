import { useState, useMemo, useRef, useEffect } from 'react'
import { X, MessageSquare, Plus, Trash2, Pin, Lock, Unlock, Eye, EyeOff, Bot, Check, ZoomIn, GitMerge, Loader2, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PillSelect, TagInput } from '@/components/NodeForm'
import { CATEGORY_LABELS } from '@/types/mental-model'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType, Conversation } from '@/types/mental-model'
import type { NodeFormData } from '@/store/mental-model-store'
import { findMatches, mergeNodes } from '@/lib/dedup'
import type { DedupMatch } from '@/lib/dedup'
import { getDefaultProvider } from '@/lib/providers'
import { cn } from '@/lib/utils'

interface Props {
  node: MentalModelNode | null
  conversations: Conversation[]
  allNodes?: MentalModelNode[]
  onClose: () => void
  onUpdate: (id: string, data: Partial<NodeFormData> & { conversationIds?: string[] }) => void
  onDelete: (id: string) => void
  onDeleteOther?: (id: string) => void
  onToggleActive?: (id: string) => void
  onTogglePin?: (id: string) => void
  onConfirm?: (id: string) => void
  onNavigateTo?: (id: string) => void
}

// ─── Category color maps ────────────────────────────────────────────────────

const CATEGORY_HEADER_BG: Record<NodeCategory, string> = {
  project:      'rgba(59,130,246,0.12)',
  conversation: 'rgba(168,85,247,0.12)',
  fact:         'rgba(34,197,94,0.12)',
  preference:   'rgba(249,115,22,0.12)',
  goal:         'rgba(236,72,153,0.12)',
  skill:        'rgba(6,182,212,0.12)',
}

const CATEGORY_HEADER_BORDER: Record<NodeCategory, string> = {
  project:      'rgba(59,130,246,0.25)',
  conversation: 'rgba(168,85,247,0.25)',
  fact:         'rgba(34,197,94,0.25)',
  preference:   'rgba(249,115,22,0.25)',
  goal:         'rgba(236,72,153,0.25)',
  skill:        'rgba(6,182,212,0.25)',
}

const CATEGORY_OPTIONS = (
  Object.entries(CATEGORY_LABELS) as [NodeCategory, string][]
).map(([value, label]) => ({ value, label }))

const MEMORY_TYPE_OPTIONS: { value: MemoryType; label: string; activeClassName: string }[] = [
  { value: 'semantic', label: 'Semantic', activeClassName: 'border-teal-500/40 text-teal-300' },
  { value: 'episodic', label: 'Episodic', activeClassName: 'border-violet-500/40 text-violet-300' },
]

const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string; activeClassName: string; dot: string }[] = [
  { value: 'high',   label: 'High',   activeClassName: 'border-green-500/40 text-green-300',  dot: 'text-green-400' },
  { value: 'medium', label: 'Medium', activeClassName: 'border-yellow-500/40 text-yellow-300', dot: 'text-yellow-400' },
  { value: 'low',    label: 'Low',    activeClassName: 'border-red-500/40 text-red-300',       dot: 'text-red-400' },
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[10px] uppercase tracking-widest t-muted', className)}>{children}</p>
}

function Divider() { return <div className="border-t t-border mx-4" /> }

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InspectorPanel({ node, conversations, allNodes, onClose, onUpdate, onDelete, onDeleteOther, onToggleActive, onTogglePin, onConfirm, onNavigateTo }: Props) {
  const [showConvPicker, setShowConvPicker] = useState(false)
  const [editingTitle, setEditingTitle]     = useState(false)
  const [titleDraft, setTitleDraft]         = useState('')
  const [liveImportance, setLiveImportance] = useState<number | null>(null)
  const [dedupHint, setDedupHint]           = useState<DedupMatch | null>(null)
  const [dedupDismissed, setDedupDismissed] = useState(false)
  const [expandedDiff, setExpandedDiff]     = useState<string | null>(null)
  const [mergeStates, setMergeStates]       = useState<Record<string, { loading: boolean; result?: { title: string; content: string } }>>({})
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingTitle) titleRef.current?.select() }, [editingTitle])
  useEffect(() => {
    setEditingTitle(false); setShowConvPicker(false); setLiveImportance(null)
    setDedupHint(null); setDedupDismissed(false); setExpandedDiff(null); setMergeStates({})
  }, [node?.id])

  // Live dedup hint while typing the title
  useEffect(() => {
    if (!editingTitle || !allNodes || !titleDraft.trim()) { setDedupHint(null); return }
    const nodeId       = node?.id
    const nodeCategory = node?.category ?? 'fact'
    const timer = setTimeout(() => {
      const matches = findMatches(
        { title: titleDraft, content: '', category: nodeCategory },
        allNodes.filter(x => x.id !== nodeId),
      )
      setDedupHint(matches[0] ?? null)
      if (matches[0]) setDedupDismissed(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [titleDraft, editingTitle, allNodes, node?.id, node?.category])

  if (!node) return null
  const n = node

  const similarMatches = useMemo(() => {
    if (!allNodes || !n.title.trim()) return []
    return findMatches({ title: n.title, content: n.content, category: n.category }, allNodes.filter(x => x.id !== n.id))
  }, [n.title, n.content, n.category, allNodes, n.id])

  function upd<K extends keyof NodeFormData>(key: K, value: NodeFormData[K]) {
    onUpdate(n.id, { [key]: value } as Partial<NodeFormData>)
  }

  function commitTitle() {
    if (titleDraft.trim() && titleDraft.trim() !== n.title) upd('title', titleDraft.trim())
    setEditingTitle(false)
    setDedupHint(null)
    setDedupDismissed(false)
  }

  async function handleMergeWith(matchId: string, match: DedupMatch) {
    setMergeStates(prev => ({ ...prev, [matchId]: { loading: true } }))
    const provider = getDefaultProvider()
    if (!provider) { setMergeStates(prev => ({ ...prev, [matchId]: { loading: false } })); return }
    const merged = await mergeNodes(
      { title: n.title, content: n.content },
      { title: match.existing.title, content: match.existing.content },
      provider,
    )
    setMergeStates(prev => ({ ...prev, [matchId]: { loading: false, result: merged ?? undefined } }))
  }

  function applyMerge(matchId: string, match: DedupMatch) {
    const s = mergeStates[matchId]
    if (!s?.result) return
    onUpdate(n.id, { title: s.result.title, content: s.result.content })
    onDeleteOther?.(match.existing.id)
    setMergeStates(prev => { const next = { ...prev }; delete next[matchId]; return next })
  }

  const nodeConvs      = conversations.filter(c => (n.conversationIds ?? []).includes(c.id))
  const availableConvs = conversations.filter(c => !(n.conversationIds ?? []).includes(c.id))

  return (
    <div className="w-80 shrink-0 border-l t-border t-sidebar flex flex-col h-full">

      {/* ── Category-colored header ── */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 shrink-0 border-b"
        style={{
          background: CATEGORY_HEADER_BG[n.category],
          borderBottomColor: CATEGORY_HEADER_BORDER[n.category],
        }}
      >
        <PillSelect
          value={n.category}
          options={CATEGORY_OPTIONS}
          onChange={v => upd('category', v)}
          dropdownAlign="right"
        />

        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
              if (e.key === 'Escape') { setEditingTitle(false); setDedupHint(null) }
            }}
            className="flex-1 text-sm font-medium t-text bg-transparent border-b border-white/25 outline-none mt-0.5"
          />
        ) : (
          <span
            className={cn(
              'flex-1 text-sm font-medium break-words mt-0.5',
              n.title ? 'cursor-text select-none t-text' : 'cursor-pointer italic opacity-40 select-none t-muted',
            )}
            onClick={n.title ? undefined : () => { setTitleDraft(''); setEditingTitle(true) }}
            onDoubleClick={() => { setTitleDraft(n.title); setEditingTitle(true) }}
            title={n.title ? 'Double-click to rename' : 'Click to add title'}
          >
            {n.title || '(untitled — click to edit)'}
          </span>
        )}

        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Live dedup hint (shown while editing title) ── */}
      {dedupHint && !dedupDismissed && editingTitle && (
        <div className="mx-3 mt-2 rounded-lg bg-yellow-500/10 border border-yellow-500/25 px-3 py-2">
          <p className="text-[11px] text-yellow-300/90 leading-snug">
            Similar to <span className="font-medium">"{dedupHint.existing.title}"</span>
            <span className="opacity-60"> · {Math.round(dedupHint.similarity * 100)}% match</span>
          </p>
          <div className="flex gap-3 mt-1.5">
            <button
              onClick={() => { onNavigateTo?.(dedupHint.existing.id); setDedupHint(null) }}
              className="text-[10px] text-yellow-300 hover:text-yellow-200 underline underline-offset-2 transition-colors"
            >
              Show me
            </button>
            <button
              onClick={() => setDedupDismissed(true)}
              className="text-[10px] t-muted hover:t-text underline underline-offset-2 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Content */}
        <div className="px-4 pt-4 pb-3">
          <FieldLabel className="mb-2">Content</FieldLabel>
          <textarea
            key={n.id}
            defaultValue={n.content}
            onBlur={e => { if (e.target.value !== n.content) upd('content', e.target.value) }}
            placeholder="What the AI knows or believes about the user"
            rows={5}
            className="w-full bg-white/[0.03] border t-border rounded-lg px-3 py-2.5 text-sm t-text placeholder:t-muted resize-y min-h-[96px] outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <Divider />

        {/* Tags */}
        <div className="px-4 py-3">
          <FieldLabel className="mb-2">Tags</FieldLabel>
          <TagInput key={n.id} tags={n.tags} onChange={tags => onUpdate(n.id, { tags })} />
        </div>

        <Divider />

        {/* Pill metadata */}
        <div className="px-4 py-3 space-y-2.5">
          <MetaRow label="Memory type">
            <PillSelect value={n.memoryType} options={MEMORY_TYPE_OPTIONS} onChange={v => upd('memoryType', v)} dropdownAlign="right" />
          </MetaRow>
          <MetaRow label="Confidence">
            <PillSelect value={n.confidence} options={CONFIDENCE_OPTIONS} onChange={v => upd('confidence', v)} dropdownAlign="right" />
          </MetaRow>
          <MetaRow label="Source">
            <PillSelect value={n.source ?? ''} options={SOURCE_OPTIONS} onChange={v => upd('source', v)} dropdownAlign="right" />
          </MetaRow>
        </div>

        {/* Importance */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>Importance</FieldLabel>
            <span className="text-[11px] font-medium tabular-nums t-muted">
              {Math.round((liveImportance ?? n.importance) * 100)}%
            </span>
          </div>
          <div className="relative flex items-center h-4">
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/10" />
            <div
              className="absolute h-1 rounded-full bg-white/40"
              style={{ width: `${(liveImportance ?? n.importance) * 100}%` }}
            />
            <input
              key={n.id}
              type="range" min={0} max={1} step={0.05}
              defaultValue={n.importance}
              onChange={e => setLiveImportance(Number(e.target.value))}
              onMouseUp={e => { const v = Number((e.target as HTMLInputElement).value); setLiveImportance(v); upd('importance', v) }}
              onTouchEnd={e => { const v = Number((e.target as HTMLInputElement).value); setLiveImportance(v); upd('importance', v) }}
              className="relative w-full cursor-pointer appearance-none bg-transparent
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-runnable-track]:opacity-0
                [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer
                [&::-moz-range-track]:opacity-0"
            />
          </div>
        </div>

        <Divider />

        {/* Conversations */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 inline-block" />
              Conversations
            </FieldLabel>
            {availableConvs.length > 0 && (
              <button
                onClick={() => setShowConvPicker(v => !v)}
                className="text-[10px] t-accent hover:underline flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>

          {nodeConvs.length === 0 && !showConvPicker && (
            <p className="text-[11px] t-muted">Not linked to any conversation.</p>
          )}

          <div className="space-y-1">
            {nodeConvs.map(conv => (
              <div key={conv.id} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border t-border px-2.5 py-1.5">
                <MessageSquare className="h-3 w-3 t-muted shrink-0" />
                <span className="text-[11px] t-text flex-1 truncate">{conv.title}</span>
                <button
                  onClick={() => onUpdate(n.id, { conversationIds: (n.conversationIds ?? []).filter(id => id !== conv.id) })}
                  className="t-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {showConvPicker && availableConvs.length > 0 && (
            <div className="rounded-lg border t-border bg-white/[0.03] overflow-hidden">
              <p className="text-[10px] t-muted px-2.5 pt-2 pb-1 uppercase tracking-wider">Link to conversation</p>
              {availableConvs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onUpdate(n.id, { conversationIds: [...(n.conversationIds ?? []), conv.id] })
                    setShowConvPicker(false)
                  }}
                  className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.05] transition-colors"
                >
                  <MessageSquare className="h-3 w-3 t-muted shrink-0" />
                  <span className="text-[11px] t-text truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Agent confirmation */}
        {n.provenance === 'agent' && !n.confirmed && (
          <>
            <Divider />
            <div className="mx-4 my-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <Bot className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300/90 flex-1">Agent extracted — confirm to keep.</p>
              <button
                className="flex items-center gap-0.5 text-[10px] text-green-400 hover:text-green-300 shrink-0"
                onClick={() => onConfirm?.(n.id)}
              ><Check className="h-3 w-3" />Keep</button>
              <button
                className="flex items-center gap-0.5 text-[10px] text-red-400 hover:text-red-300 shrink-0"
                onClick={() => { onDelete(n.id); onClose() }}
              ><X className="h-3 w-3" />Discard</button>
            </div>
          </>
        )}

        {/* Similar nodes */}
        {similarMatches.length > 0 && (
          <>
            <Divider />
            <div className="px-4 py-3 space-y-2">
              <FieldLabel className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 inline-block text-yellow-400/80" />
                Similar nodes
              </FieldLabel>
              {similarMatches.map(match => {
                const ms      = mergeStates[match.existing.id]
                const showDiff = expandedDiff === match.existing.id
                return (
                  <div key={match.existing.id} className="rounded-lg border t-border bg-white/[0.02] overflow-hidden">

                    {/* Match header row */}
                    <div className="flex items-start gap-2 px-2.5 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] t-muted leading-snug mb-0.5">
                          {match.kind === 'duplicate' ? 'Likely duplicate' : 'Possible conflict'}
                          <span className="opacity-60"> · {Math.round(match.similarity * 100)}%</span>
                        </p>
                        <p className="text-xs font-medium t-text truncate">{match.existing.title}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        <button
                          onClick={() => onNavigateTo?.(match.existing.id)}
                          title="Zoom to node"
                          className="p-1 rounded t-muted hover:t-text hover:bg-white/[0.06] transition-colors"
                        >
                          <ZoomIn className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleMergeWith(match.existing.id, match)}
                          disabled={ms?.loading}
                          title="Merge with AI"
                          className="p-1 rounded t-muted hover:text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ms?.loading
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <GitMerge className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => setExpandedDiff(showDiff ? null : match.existing.id)}
                          title="Compare content"
                          className={cn(
                            'p-1 rounded transition-colors',
                            showDiff ? 'text-blue-300 bg-blue-500/10' : 't-muted hover:text-blue-300 hover:bg-blue-500/10',
                          )}
                        >
                          <ArrowLeftRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDeleteOther?.(match.existing.id)}
                          title="Delete other node"
                          className="p-1 rounded t-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Merge result preview */}
                    {ms?.result && (
                      <div className="px-2.5 pb-2.5 border-t t-border">
                        <p className="text-[10px] text-blue-400 font-medium pt-2 mb-1">Merged result</p>
                        <p className="text-xs font-medium t-text">{ms.result.title}</p>
                        <p className="text-[11px] t-muted mt-0.5 leading-snug">{ms.result.content}</p>
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => applyMerge(match.existing.id, match)}
                            className="text-[10px] text-green-400 hover:text-green-300 transition-colors"
                          >
                            Apply merge
                          </button>
                          <button
                            onClick={() => setMergeStates(p => { const next = { ...p }; delete next[match.existing.id]; return next })}
                            className="text-[10px] t-muted hover:t-text transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Side-by-side diff */}
                    {showDiff && (
                      <div className="px-2.5 pb-2.5 border-t t-border">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div>
                            <p className="text-[9px] t-muted uppercase tracking-wider mb-1">This node</p>
                            <p className="text-[11px] t-text leading-snug line-clamp-5">
                              {n.content || <em className="opacity-40">empty</em>}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] t-muted uppercase tracking-wider mb-1">Other</p>
                            <p className="text-[11px] t-text leading-snug line-clamp-5">
                              {match.existing.content || <em className="opacity-40">empty</em>}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          </>
        )}

        <Divider />

        {/* Actions row */}
        <div className="px-4 py-4 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost"
              className={cn('h-7 w-7', n.pinned ? 'text-amber-300' : 't-muted hover:t-text')}
              title={n.pinned ? 'Unpin' : 'Pin (prevent decay)'}
              onClick={() => onTogglePin?.(n.id)}
            >
              <Pin className="h-3.5 w-3.5" fill={n.pinned ? 'currentColor' : 'none'} />
            </Button>
            <Button size="icon" variant="ghost"
              className={cn('h-7 w-7', !n.active ? 'text-red-300' : 't-muted hover:t-text')}
              title={n.active ? 'Hide from agent' : 'Show to agent'}
              onClick={() => onToggleActive?.(n.id)}
            >
              {n.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost"
              className={cn('h-7 w-7', n.sensitive ? 'text-orange-300' : 't-muted hover:t-text')}
              title={n.sensitive ? 'Sensitive — excluded from context' : 'Mark as sensitive'}
              onClick={() => upd('sensitive', !n.sensitive)}
            >
              {n.sensitive ? <Lock className="h-3.5 w-3.5 [&_rect]:fill-current [&_path]:fill-none [&_path]:[stroke-width:2.5]" /> : <Unlock className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex-1" />

          <button
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors px-2 py-1"
            onClick={() => { onDelete(n.id); onClose() }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

      </div>
    </div>
  )
}
