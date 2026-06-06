import { useState } from 'react'
import { X, GitMerge, Copy, Replace, Loader2, AlertTriangle, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDefaultProvider } from '@/lib/providers'
import { checkConflict, mergeNodes, type ClassifiedNode, type DedupMatch } from '@/lib/dedup'
import type { MentalModelNode } from '@/types/mental-model'
import { cn } from '@/lib/utils'

interface Props {
  classified: ClassifiedNode[]
  cleanCount: number
  onResolve: (actions: ResolvedAction[]) => void
  onCancel: () => void
}

export type ResolvedAction =
  | { kind: 'add';     node: Record<string, unknown> }
  | { kind: 'replace'; replaceId: string; node: Record<string, unknown> }
  | { kind: 'merge';   replaceId: string; merged: { title: string; content: string }; base: Record<string, unknown> }
  | { kind: 'skip' }

type ItemAction = 'add' | 'replace' | 'merge' | 'skip' | null

interface ItemState {
  action: ItemAction
  mergedResult?: { title: string; content: string }
  merging?: boolean
  conflictChecked?: boolean
  isConflict?: boolean
}

export function DedupReviewModal({ classified, cleanCount, onResolve, onCancel }: Props) {
  const [states, setStates] = useState<ItemState[]>(() => classified.map(() => ({ action: null })))
  const [provider] = useState(getDefaultProvider)

  function setState(i: number, patch: Partial<ItemState>) {
    setStates(prev => prev.map((s, j) => j === i ? { ...s, ...patch } : s))
  }

  const allDecided = states.every(s => s.action !== null)

  async function handleCheckConflict(i: number, match: DedupMatch) {
    setState(i, { conflictChecked: false })
    const { node } = classified[i]
    const isConflict = await checkConflict(
      { title: node.title as string, content: node.content as string },
      { title: match.existing.title, content: match.existing.content },
      provider,
    )
    setState(i, { conflictChecked: true, isConflict })
  }

  async function handleMerge(i: number, match: DedupMatch) {
    setState(i, { merging: true })
    const { node } = classified[i]
    const merged = await mergeNodes(
      { title: node.title as string, content: node.content as string },
      { title: match.existing.title, content: match.existing.content },
      provider,
    )
    setState(i, { merging: false, action: 'merge', mergedResult: merged ?? undefined })
  }

  function commit() {
    const actions: ResolvedAction[] = classified.map((c, i) => {
      const s = states[i]
      const topMatch = c.matches[0]
      switch (s.action) {
        case 'add':     return { kind: 'add', node: c.node }
        case 'replace': return { kind: 'replace', replaceId: topMatch.existing.id, node: c.node }
        case 'merge':   return s.mergedResult
          ? { kind: 'merge', replaceId: topMatch.existing.id, merged: s.mergedResult, base: c.node }
          : { kind: 'add', node: c.node }
        case 'skip':    return { kind: 'skip' }
        default:        return { kind: 'add', node: c.node }
      }
    })
    onResolve(actions)
  }

  return (
    <div className="flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3 border-b t-border shrink-0">
        <div>
          <p className="text-sm font-semibold t-text">Review incoming nodes</p>
          <p className="text-[11px] t-muted mt-0.5">
            {classified.length} possible duplicate{classified.length !== 1 ? 's' : ''} · {cleanCount} clean (will be added automatically)
          </p>
        </div>
        <button onClick={onCancel} className="t-muted hover:t-text">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Items */}
      <div className="overflow-y-auto flex-1 py-3 space-y-4">
        {classified.map((c, i) => {
          const s = states[i]
          const topMatch = c.matches[0]
          return (
            <div key={i} className="space-y-2">
              <MatchBadge kind={topMatch.kind} similarity={topMatch.similarity} isConflict={s.isConflict} />

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-2">
                <NodePreview label="Incoming" node={c.node} highlight />
                <NodePreview label="Existing" node={topMatch.existing} />
              </div>

              {/* Merged preview */}
              {s.action === 'merge' && s.mergedResult && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2">
                  <p className="text-[10px] text-blue-400 font-semibold mb-1 uppercase tracking-wider">Merged result</p>
                  <p className="text-xs font-medium t-text">{s.mergedResult.title}</p>
                  <p className="text-[11px] t-muted mt-0.5">{s.mergedResult.content}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] t-muted mr-1">Action:</span>

                <ActionChip
                  active={s.action === 'merge'}
                  disabled={s.merging}
                  onClick={() => handleMerge(i, topMatch)}
                  icon={s.merging ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
                  label={s.merging ? 'Merging…' : 'Merge (AI)'}
                  color="blue"
                />
                <ActionChip
                  active={s.action === 'add'}
                  onClick={() => setState(i, { action: 'add' })}
                  icon={<Copy className="h-3 w-3" />}
                  label="Keep both"
                  color="green"
                />
                <ActionChip
                  active={s.action === 'replace'}
                  onClick={() => setState(i, { action: 'replace' })}
                  icon={<Replace className="h-3 w-3" />}
                  label="Replace existing"
                  color="orange"
                />
                <ActionChip
                  active={s.action === 'skip'}
                  onClick={() => setState(i, { action: 'skip' })}
                  icon={<X className="h-3 w-3" />}
                  label="Skip"
                  color="gray"
                />

                {topMatch.kind === 'conflict' && !s.conflictChecked && (
                  <button
                    onClick={() => handleCheckConflict(i, topMatch)}
                    className="ml-auto text-[10px] text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
                  >
                    Check contradiction (AI)
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-3 border-t t-border shrink-0">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="ml-auto"
          onClick={commit}
          disabled={!allDecided}
        >
          Apply {classified.length + cleanCount} nodes
        </Button>
      </div>
    </div>
  )
}

function MatchBadge({ kind, similarity, isConflict }: { kind: DedupMatch['kind']; similarity: number; isConflict?: boolean }) {
  const pct = Math.round(similarity * 100)
  return (
    <div className="flex items-center gap-2">
      {kind === 'duplicate' ? (
        <span className="flex items-center gap-1 text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5">
          <GitBranch className="h-2.5 w-2.5" />Likely duplicate · {pct}% title match
        </span>
      ) : (
        <span className={cn(
          'flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5',
          isConflict
            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
            : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
        )}>
          <AlertTriangle className="h-2.5 w-2.5" />
          {isConflict ? 'Contradiction confirmed' : `Possible conflict · ${pct}% title match`}
        </span>
      )}
    </div>
  )
}

function NodePreview({ label, node, highlight }: { label: string; node: Record<string, unknown> | MentalModelNode; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border px-2.5 py-2 text-[11px]',
      highlight ? 'border-white/20 bg-white/[0.04]' : 't-border bg-white/[0.02]',
    )}>
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="font-medium t-text leading-snug">{node.title as string}</p>
      <p className="t-muted mt-0.5 leading-snug line-clamp-2">{node.content as string}</p>
    </div>
  )
}

function ActionChip({ active, disabled, onClick, icon, label, color }: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  color: 'blue' | 'green' | 'orange' | 'gray'
}) {
  const colors = {
    blue:   { active: 'bg-blue-500/20 text-blue-300 border-blue-500/40',   base: 'text-blue-400/60   border-blue-500/20   hover:text-blue-300'   },
    green:  { active: 'bg-green-500/20 text-green-300 border-green-500/40', base: 'text-green-400/60  border-green-500/20  hover:text-green-300'  },
    orange: { active: 'bg-orange-500/20 text-orange-300 border-orange-500/40', base: 'text-orange-400/60 border-orange-500/20 hover:text-orange-300' },
    gray:   { active: 'bg-white/10 t-text border-white/20',                  base: 't-muted t-border hover:t-text'                                 },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 text-[10px] border rounded px-2 py-1 transition-colors',
        active ? colors[color].active : colors[color].base,
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {icon}{label}
    </button>
  )
}
