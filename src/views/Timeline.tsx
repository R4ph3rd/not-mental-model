import {
  FolderKanban, MessageSquare, Lightbulb, Heart, Target, Zap,
  Bot, Sparkles, Lock, Pin,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { computeDecayScore, decayBarColor, decayLabel } from '@/lib/decay'
import type { MentalModelNode, NodeCategory } from '@/types/mental-model'
import { CATEGORY_COLORS, CONFIDENCE_COLORS } from '@/types/mental-model'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<NodeCategory, React.ReactNode> = {
  project:      <FolderKanban className="h-3.5 w-3.5" />,
  conversation: <MessageSquare className="h-3.5 w-3.5" />,
  fact:         <Lightbulb className="h-3.5 w-3.5" />,
  preference:   <Heart className="h-3.5 w-3.5" />,
  goal:         <Target className="h-3.5 w-3.5" />,
  skill:        <Zap className="h-3.5 w-3.5" />,
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return 'Today'
  if (dDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface Props {
  nodes: MentalModelNode[]
  onEditRequest: (id: string) => void
}

export function Timeline({ nodes, onEditRequest }: Props) {
  // Sort by createdAt descending (newest first)
  const sorted = [...nodes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Group by date
  const groups: Array<{ label: string; items: MentalModelNode[] }> = []
  for (const node of sorted) {
    const label = formatDate(node.createdAt)
    const last = groups[groups.length - 1]
    if (!last || last.label !== label) groups.push({ label, items: [node] })
    else last.items.push(node)
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {groups.length === 0 && (
        <div className="flex items-center justify-center h-40 t-muted text-sm">No memories yet.</div>
      )}

      {groups.map(group => (
        <div key={group.label} className="mb-6">
          {/* Date header */}
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[11px] font-semibold t-muted uppercase tracking-wider shrink-0">{group.label}</p>
            <div className="flex-1 h-px t-border" />
            <div className="w-[60px] shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[10px] font-bold t-muted uppercase tracking-wider cursor-help">R</p>
                </TooltipTrigger>
                <TooltipContent>Retention: recency × 0.4 + importance × 0.35 + confidence × 0.25</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Timeline items */}
          <div className="relative">
            {/* Vertical track */}
            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-white/8" />

            <div className="space-y-1">
              {group.items.map(node => {
                const decay = computeDecayScore(node)
                const isUnconfirmed = node.provenance === 'agent' && !node.confirmed
                return (
                  <button
                    key={node.id}
                    onClick={() => onEditRequest(node.id)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors group',
                      't-card/50 hover:t-card border border-transparent hover:t-border',
                      !node.active && 'opacity-40',
                      isUnconfirmed && 'border-l-2 border-l-amber-400/50',
                    )}
                  >
                    {/* Time */}
                    <span className="text-[10px] t-muted tabular-nums mt-0.5 shrink-0 w-10 text-right">
                      {timeStr(node.createdAt)}
                    </span>

                    {/* Category dot on the track */}
                    <div className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                      CATEGORY_COLORS[node.category],
                    )}>
                      {CATEGORY_ICONS[node.category]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium t-text truncate">{node.title}</span>
                        {node.pinned && <Pin className="h-3 w-3 text-amber-400 shrink-0" fill="currentColor" />}
                        {node.sensitive && <Lock className="h-3 w-3 text-orange-400 shrink-0" />}
                        {node.provenance === 'agent' && <Bot className={cn('h-3 w-3 shrink-0', isUnconfirmed ? 'text-amber-400' : 'text-blue-400/60')} />}
                        {node.provenance === 'extracted' && <Sparkles className="h-3 w-3 text-purple-400/60 shrink-0" />}
                        <span className={cn('text-[10px] shrink-0', CONFIDENCE_COLORS[node.confidence])}>●</span>
                      </div>
                      <p className="text-xs t-muted mt-0.5 line-clamp-1">{node.content}</p>
                    </div>

                    {/* Mini decay bar */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 shrink-0 mt-1 cursor-help">
                          <div className="w-12 h-1 rounded-full bg-white/8 overflow-hidden">
                            <div className={cn('h-full rounded-full', decayBarColor(decay))}
                              style={{ width: `${decay * 100}%` }} />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-bold">R:</span> {decayLabel(decay)} ({Math.round(decay * 100)}%)
                      </TooltipContent>
                    </Tooltip>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
