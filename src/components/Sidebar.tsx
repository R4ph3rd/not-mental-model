import { Brain, FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'

const CATEGORY_ICONS: Record<NodeCategory | 'all', React.ReactNode> = {
  all: <Brain className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
  conversation: <MessageSquare className="h-4 w-4" />,
  fact: <Lightbulb className="h-4 w-4" />,
  preference: <Heart className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  skill: <Zap className="h-4 w-4" />,
}

const CATEGORY_FILTERS: Array<NodeCategory | 'all'> = ['all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill']

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
    <aside className="w-56 shrink-0 border-r border-white/8 flex flex-col gap-0.5 py-4 px-3 overflow-y-auto">
      {/* Agent visibility summary */}
      <div className="mb-3 px-2 py-2 rounded-md bg-white/3 border border-white/8">
        <p className="text-[10px] text-white/30 mb-0.5">Active for agent</p>
        <p className="text-sm font-semibold text-white">{activeCount} <span className="text-white/30 font-normal">/ {total}</span></p>
      </div>

      {/* Categories */}
      <p className="text-[10px] uppercase tracking-widest text-white/25 px-2 mb-1">Categories</p>
      {CATEGORY_FILTERS.map(f => {
        const count = f === 'all' ? total : counts[f] ?? 0
        const active = categoryFilter === f && scopeFilter === ''
        return (
          <button
            key={f}
            onClick={() => { onCategoryFilter(f); onScopeFilter('') }}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full',
              active ? 'bg-purple-600/20 text-purple-300' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <span className={active ? 'text-purple-400' : 'text-white/25'}>{CATEGORY_ICONS[f]}</span>
            <span className="flex-1 text-xs">{f === 'all' ? 'All nodes' : CATEGORY_LABELS[f]}</span>
            <span className={cn('text-xs tabular-nums', active ? 'text-purple-400' : 'text-white/20')}>{count}</span>
          </button>
        )
      })}

      {/* Scopes — CHI 2025: hierarchical project/domain groups */}
      {scopes.length > 0 && (
        <>
          <div className="mt-4 mb-1 px-2 flex items-center gap-1">
            <p className="text-[10px] uppercase tracking-widest text-white/25">Scopes</p>
          </div>
          {scopes.map(scope => {
            const active = scopeFilter === scope
            return (
              <button
                key={scope}
                onClick={() => { onScopeFilter(active ? '' : scope); onCategoryFilter('all') }}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors text-left w-full',
                  active ? 'bg-purple-600/20 text-purple-300' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                )}
              >
                <Folder className={cn('h-3.5 w-3.5', active ? 'text-purple-400' : 'text-white/20')} />
                <span className="flex-1">{scope}</span>
              </button>
            )
          })}
        </>
      )}
    </aside>
  )
}
