import { Brain, FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'

const ICONS: Record<NodeCategory | 'all', React.ReactNode> = {
  all: <Brain className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
  conversation: <MessageSquare className="h-4 w-4" />,
  fact: <Lightbulb className="h-4 w-4" />,
  preference: <Heart className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  skill: <Zap className="h-4 w-4" />,
}

interface Props {
  counts: Record<NodeCategory, number>
  total: number
  activeFilter: NodeCategory | 'all'
  onFilter: (f: NodeCategory | 'all') => void
}

const FILTERS: Array<NodeCategory | 'all'> = ['all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill']

export function Sidebar({ counts, total, activeFilter, onFilter }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-white/8 flex flex-col gap-1 py-4 px-3">
      <p className="text-[10px] uppercase tracking-widest text-white/25 px-2 mb-1">Categories</p>
      {FILTERS.map(f => {
        const count = f === 'all' ? total : counts[f] ?? 0
        const active = activeFilter === f
        return (
          <button
            key={f}
            onClick={() => onFilter(f)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors text-left w-full',
              active
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <span className={active ? 'text-purple-400' : 'text-white/30'}>{ICONS[f]}</span>
            <span className="flex-1">{f === 'all' ? 'All nodes' : CATEGORY_LABELS[f]}</span>
            <span className={cn('text-xs tabular-nums', active ? 'text-purple-400' : 'text-white/25')}>{count}</span>
          </button>
        )
      })}
    </aside>
  )
}
