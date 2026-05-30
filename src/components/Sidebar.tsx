import { Brain, FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap, Folder, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'

const CATEGORY_ICONS: Record<NodeCategory | 'all', React.ReactNode> = {
  all:          <Brain className="h-4 w-4" />,
  project:      <FolderKanban className="h-4 w-4" />,
  conversation: <MessageSquare className="h-4 w-4" />,
  fact:         <Lightbulb className="h-4 w-4" />,
  preference:   <Heart className="h-4 w-4" />,
  goal:         <Target className="h-4 w-4" />,
  skill:        <Zap className="h-4 w-4" />,
}

const CATEGORY_FILTERS: Array<NodeCategory | 'all'> = [
  'all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill',
]

interface Props {
  counts: Record<NodeCategory, number>
  total: number
  activeCount: number
  categoryFilter: NodeCategory | 'all'
  scopeFilter: string
  scopes: string[]
  onCategoryFilter: (f: NodeCategory | 'all') => void
  onScopeFilter: (s: string) => void
}

export function Sidebar({
  counts, total, activeCount,
  categoryFilter, scopeFilter, scopes,
  onCategoryFilter, onScopeFilter,
}: Props) {
  return (
    <aside className="w-52 shrink-0 border-r t-border t-sidebar flex flex-col gap-0.5 py-4 px-2 overflow-y-auto">
      {/* Context counter */}
      <div className="mx-1 mb-3 px-3 py-2.5 rounded-lg border t-border t-card">
        <p className="text-[10px] uppercase tracking-widest t-muted mb-0.5 flex items-center gap-1">
          <Eye className="h-3 w-3" />
          Visible to agent
        </p>
        <p className="text-lg font-bold t-text leading-none">
          {activeCount}
          <span className="text-sm font-normal t-muted"> / {total}</span>
        </p>
        <p className="text-[10px] t-muted mt-1">nodes sent in context</p>
      </div>

      <p className="text-[10px] uppercase tracking-widest t-muted px-3 mb-1">Categories</p>
      {CATEGORY_FILTERS.map(f => {
        const count = f === 'all' ? total : counts[f] ?? 0
        const active = categoryFilter === f && scopeFilter === ''
        return (
          <button
            key={f}
            onClick={() => { onCategoryFilter(f); onScopeFilter('') }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full',
              active
                ? 't-accent-subtle t-accent font-medium'
                : 't-muted hover:t-card hover:t-text'
            )}
          >
            <span className={cn('shrink-0', active ? 't-accent' : 't-muted')}>
              {CATEGORY_ICONS[f]}
            </span>
            <span className="flex-1 text-xs">{f === 'all' ? 'All nodes' : CATEGORY_LABELS[f]}</span>
            <span className={cn('text-xs tabular-nums', active ? 't-accent' : 't-muted')}>{count}</span>
          </button>
        )
      })}

      {/* CHI 2025: project/domain scope hierarchy */}
      {scopes.length > 0 && (
        <>
          <div className="mt-4 mb-1 px-3">
            <p className="text-[10px] uppercase tracking-widest t-muted">Scopes</p>
          </div>
          {scopes.map(scope => {
            const active = scopeFilter === scope
            return (
              <button
                key={scope}
                onClick={() => { onScopeFilter(active ? '' : scope); onCategoryFilter('all') }}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-colors text-left w-full',
                  active
                    ? 't-accent-subtle t-accent font-medium'
                    : 't-muted hover:t-card hover:t-text'
                )}
              >
                <Folder className={cn('h-3.5 w-3.5 shrink-0', active ? 't-accent' : 't-muted')} />
                <span className="flex-1 truncate">{scope}</span>
              </button>
            )
          })}
        </>
      )}
    </aside>
  )
}
