import { useState, useRef } from 'react'
import {
  Brain, MessageSquare, Lightbulb, Heart, Target, Zap,
  Eye, ChevronDown, ChevronRight, Plus, Folder, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory, Project, Conversation, MentalModelNode } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'

const CATEGORY_ICONS: Record<NodeCategory | 'all', React.ReactNode> = {
  all:          <Brain className="h-3.5 w-3.5" />,
  project:      <Folder className="h-3.5 w-3.5" />,
  conversation: <MessageSquare className="h-3.5 w-3.5" />,
  fact:         <Lightbulb className="h-3.5 w-3.5" />,
  preference:   <Heart className="h-3.5 w-3.5" />,
  goal:         <Target className="h-3.5 w-3.5" />,
  skill:        <Zap className="h-3.5 w-3.5" />,
}


interface Props {
  nodes: MentalModelNode[]
  activeCount: number
  categoryFilter: NodeCategory | 'all'
  projectFilter: string | null
  conversationFilter: string | null
  projects: Project[]
  conversations: Conversation[]
  onCategoryFilter: (f: NodeCategory | 'all') => void
  onProjectFilter: (id: string | null) => void
  onConversationFilter: (id: string | null) => void
  onAddProject: (name: string) => void
  onAddConversation: (projectId: string, title: string) => void
}

function InlineInput({ placeholder, onSubmit, onCancel }: {
  placeholder: string
  onSubmit: (v: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input ref={ref} autoFocus value={v} onChange={e => setV(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-b t-border text-xs t-text outline-none placeholder:t-muted py-0.5"
        onKeyDown={e => {
          if (e.key === 'Enter' && v.trim()) { onSubmit(v.trim()); setV('') }
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => { if (v.trim()) onSubmit(v.trim()); else onCancel() }}
      />
      <button onClick={onCancel} className="t-muted hover:t-text"><X className="h-3 w-3" /></button>
    </div>
  )
}

export function Sidebar({
  nodes, activeCount,
  categoryFilter, projectFilter, conversationFilter,
  projects, conversations,
  onCategoryFilter, onProjectFilter, onConversationFilter,
  onAddProject, onAddConversation,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(projects.map(p => p.id))
  )
  const [addingProject, setAddingProject] = useState(false)
  const [addingConvIn, setAddingConvIn] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function nodeCountForProject(projectId: string) {
    return nodes.filter(n => n.projectId === projectId).length
  }
  function nodeCountForConv(convId: string) {
    return nodes.filter(n => n.conversationId === convId).length
  }

  const total = nodes.length
  const noFilter = !projectFilter && !conversationFilter
  const categoryCounts = {} as Record<NodeCategory, number>
  for (const n of nodes) categoryCounts[n.category] = (categoryCounts[n.category] ?? 0) + 1

  return (
    <aside className="w-52 shrink-0 border-r t-border t-sidebar flex flex-col py-3 overflow-y-auto">

      {/* Context counter */}
      <div className="mx-2 mb-3 px-3 py-2 rounded-lg border t-border t-card">
        <p className="text-[10px] uppercase tracking-widest t-muted mb-0.5 flex items-center gap-1">
          <Eye className="h-3 w-3" /> Visible to agent
        </p>
        <p className="text-lg font-bold t-text leading-none">
          {activeCount}<span className="text-sm font-normal t-muted"> / {total}</span>
        </p>
        <p className="text-[10px] t-muted mt-0.5">nodes in context</p>
      </div>

      {/* All nodes */}
      <button onClick={() => { onProjectFilter(null); onConversationFilter(null) }}
        className={cn(
          'mx-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs w-[calc(100%-8px)] text-left transition-colors',
          noFilter ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-card hover:t-text'
        )}>
        <Brain className={cn('h-3.5 w-3.5 shrink-0', noFilter ? 't-accent' : '')} />
        <span className="flex-1">All nodes</span>
        <span className="tabular-nums text-[10px]">{total}</span>
      </button>

      {/* Projects */}
      <div className="mt-3 mb-1 px-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest t-muted">Projects</p>
        <button onClick={() => setAddingProject(true)}
          className="t-muted hover:t-accent transition-colors">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {projects.map(project => {
        const convs = conversations.filter(c => c.projectId === project.id)
        const isOpen = expanded.has(project.id)
        const isProjectActive = projectFilter === project.id && !conversationFilter

        return (
          <div key={project.id}>
            {/* Project row */}
            <div className={cn(
              'mx-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
              isProjectActive ? 't-accent-subtle' : 'hover:t-card'
            )}>
              <button onClick={() => toggleExpanded(project.id)} className="t-muted hover:t-text">
                {isOpen
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />}
              </button>
              <button
                onClick={() => { onProjectFilter(project.id); onConversationFilter(null) }}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className={cn('flex-1 truncate font-medium', isProjectActive ? 't-accent' : 't-text')}>
                  {project.name}
                </span>
                <span className={cn('tabular-nums text-[10px]', isProjectActive ? 't-accent' : 't-muted')}>
                  {nodeCountForProject(project.id)}
                </span>
              </button>
            </div>

            {/* Conversations */}
            {isOpen && (
              <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                {convs.map(conv => {
                  const isConvActive = conversationFilter === conv.id
                  return (
                    <button key={conv.id}
                      onClick={() => { onProjectFilter(project.id); onConversationFilter(conv.id) }}
                      className={cn(
                        'flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-left transition-colors group',
                        isConvActive ? 't-accent-subtle' : 'hover:t-card'
                      )}>
                      <MessageSquare className={cn('h-3 w-3 shrink-0', isConvActive ? 't-accent' : 't-muted')} />
                      <span className={cn('flex-1 truncate text-[11px]', isConvActive ? 't-accent font-medium' : 't-muted group-hover:t-text')}>
                        {conv.title}
                      </span>
                      <span className="text-[10px] t-muted tabular-nums shrink-0">
                        {nodeCountForConv(conv.id)}
                      </span>
                    </button>
                  )
                })}

                {addingConvIn === project.id
                  ? <InlineInput placeholder="Conversation title…"
                      onSubmit={t => { onAddConversation(project.id, t); setAddingConvIn(null) }}
                      onCancel={() => setAddingConvIn(null)} />
                  : <button onClick={() => setAddingConvIn(project.id)}
                      className="flex items-center gap-1 text-[10px] t-muted hover:t-accent px-2 py-1 w-full transition-colors">
                      <Plus className="h-2.5 w-2.5" /> New conversation
                    </button>
                }
              </div>
            )}
          </div>
        )
      })}

      {addingProject
        ? <InlineInput placeholder="Project name…"
            onSubmit={n => { onAddProject(n); setAddingProject(false) }}
            onCancel={() => setAddingProject(false)} />
        : null
      }

      {/* Category filter */}
      <div className="mt-4 mb-1 px-3">
        <p className="text-[10px] uppercase tracking-widest t-muted">Filter by type</p>
      </div>
      {(['all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill'] as const).map(f => {
        const count = f === 'all' ? total : categoryCounts[f] ?? 0
        const active = categoryFilter === f
        return (
          <button key={f} onClick={() => onCategoryFilter(f)}
            className={cn(
              'mx-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs w-[calc(100%-8px)] text-left transition-colors',
              active ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-card hover:t-text'
            )}>
            <span className={cn('shrink-0', active ? 't-accent' : 't-muted')}>
              {CATEGORY_ICONS[f]}
            </span>
            <span className="flex-1">{f === 'all' ? 'All types' : CATEGORY_LABELS[f]}</span>
            <span className={cn('text-[10px] tabular-nums', active ? 't-accent' : 't-muted')}>{count}</span>
          </button>
        )
      })}
    </aside>
  )
}
