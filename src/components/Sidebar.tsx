import { useState } from 'react'
import {
  Brain, MessageSquare, Lightbulb, Heart, Target, Zap,
  Eye, EyeOff, ChevronDown, ChevronRight, Plus, Folder, X, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory, Project, Conversation, MemoryGroup, MentalModelNode } from '@/types/mental-model'
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

function InlineInput({ placeholder, onSubmit, onCancel }: {
  placeholder: string; onSubmit: (v: string) => void; onCancel: () => void
}) {
  const [v, setV] = useState('')
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input autoFocus value={v} onChange={e => setV(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent border-b t-border text-xs t-text outline-none placeholder:t-muted py-0.5"
        onKeyDown={e => {
          if (e.key === 'Enter' && v.trim()) { onSubmit(v.trim()); }
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => { if (v.trim()) onSubmit(v.trim()); else onCancel() }}
      />
      <button onClick={onCancel} className="t-muted hover:t-text"><X className="h-3 w-3" /></button>
    </div>
  )
}

interface Props {
  nodes: MentalModelNode[]
  activeCount: number
  categoryFilter: NodeCategory | 'all'
  projectFilter: string | null
  conversationFilter: string | null
  groupFilter: string | null
  projects: Project[]
  conversations: Conversation[]
  groups: MemoryGroup[]
  onCategoryFilter: (f: NodeCategory | 'all') => void
  onProjectFilter: (id: string | null) => void
  onConversationFilter: (id: string | null) => void
  onGroupFilter: (id: string | null) => void
  onAddProject: (name: string) => void
  onAddConversation: (projectId: string, title: string) => void
  onAddGroup: (name: string) => void
  onToggleGroupActive: (id: string) => void
}

export function Sidebar({
  nodes, activeCount,
  categoryFilter, projectFilter, conversationFilter, groupFilter,
  projects, conversations, groups,
  onCategoryFilter, onProjectFilter, onConversationFilter, onGroupFilter,
  onAddProject, onAddConversation, onAddGroup, onToggleGroupActive,
}: Props) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(projects.map(p => p.id))
  )
  const [expandedGroups, setExpandedGroups] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [addingConvIn, setAddingConvIn] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)

  function toggleProject(id: string) {
    setExpandedProjects(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const total = nodes.length
  const noFilter = !projectFilter && !conversationFilter && !groupFilter

  // counts
  const countByProject = (pid: string) => nodes.filter(n => n.projectId === pid).length
  const countByConv = (cid: string) => nodes.filter(n => n.conversationIds.includes(cid)).length
  const countByGroup = (gid: string) => nodes.filter(n => n.groupIds.includes(gid)).length
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
      <button onClick={() => { onProjectFilter(null); onConversationFilter(null); onGroupFilter(null) }}
        className={cn('mx-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs w-[calc(100%-8px)] text-left transition-colors',
          noFilter ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-card hover:t-text')}>
        <Brain className={cn('h-3.5 w-3.5 shrink-0', noFilter ? 't-accent' : '')} />
        <span className="flex-1">All nodes</span>
        <span className="tabular-nums text-[10px]">{total}</span>
      </button>

      {/* ── Projects ─────────────────────────────────────────────── */}
      <div className="mt-3 mb-1 px-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest t-muted">Projects</p>
        <button onClick={() => setAddingProject(true)} className="t-muted hover:t-accent transition-colors">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {projects.map(project => {
        const convs = conversations.filter(c => c.projectId === project.id)
        const isOpen = expandedProjects.has(project.id)
        const isActive = projectFilter === project.id && !conversationFilter

        return (
          <div key={project.id}>
            <div className={cn('mx-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
              isActive ? 't-accent-subtle' : 'hover:t-card')}>
              <button onClick={() => toggleProject(project.id)} className="t-muted hover:t-text">
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              <button onClick={() => { onProjectFilter(project.id); onConversationFilter(null); onGroupFilter(null) }}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className={cn('flex-1 truncate font-medium', isActive ? 't-accent' : 't-text')}>{project.name}</span>
                <span className={cn('tabular-nums text-[10px]', isActive ? 't-accent' : 't-muted')}>{countByProject(project.id)}</span>
              </button>
            </div>

            {isOpen && (
              <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                {convs.map(conv => {
                  const isConvActive = conversationFilter === conv.id
                  return (
                    <button key={conv.id}
                      onClick={() => { onProjectFilter(project.id); onConversationFilter(conv.id); onGroupFilter(null) }}
                      className={cn('flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-left transition-colors group',
                        isConvActive ? 't-accent-subtle' : 'hover:t-card')}>
                      <MessageSquare className={cn('h-3 w-3 shrink-0', isConvActive ? 't-accent' : 't-muted')} />
                      <span className={cn('flex-1 truncate text-[11px]', isConvActive ? 't-accent font-medium' : 't-muted group-hover:t-text')}>
                        {conv.title}
                      </span>
                      <span className="text-[10px] t-muted tabular-nums shrink-0">{countByConv(conv.id)}</span>
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

      {addingProject && (
        <InlineInput placeholder="Project name…"
          onSubmit={n => { onAddProject(n); setAddingProject(false) }}
          onCancel={() => setAddingProject(false)} />
      )}

      {/* ── Memory groups — Jones CHI 2025 ──────────────────────── */}
      <div className="mt-4 mb-1 px-3 flex items-center justify-between">
        <button onClick={() => setExpandedGroups(v => !v)}
          className="flex items-center gap-1.5 t-muted hover:t-text transition-colors">
          <Layers className="h-3 w-3" />
          <p className="text-[10px] uppercase tracking-widest">Groups</p>
          {expandedGroups ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        </button>
        <button onClick={() => setAddingGroup(true)} className="t-muted hover:t-accent transition-colors">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {expandedGroups && (
        <>
          {groups.map(group => {
            const isGroupFilter = groupFilter === group.id
            return (
              <div key={group.id}
                className={cn('mx-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                  isGroupFilter ? 't-accent-subtle' : 'hover:t-card')}>
                <button
                  onClick={() => { onGroupFilter(isGroupFilter ? null : group.id); onProjectFilter(null); onConversationFilter(null) }}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                  <span className="h-2 w-2 rounded-full shrink-0 opacity-70" style={{ backgroundColor: group.color }} />
                  <span className={cn('flex-1 truncate', isGroupFilter ? 't-accent font-medium' : 't-muted group-hover:t-text')}>
                    {group.name}
                  </span>
                  <span className="text-[10px] t-muted tabular-nums shrink-0">{countByGroup(group.id)}</span>
                </button>
                {/* Bulk toggle — Jones CHI 2025 */}
                <button
                  onClick={() => onToggleGroupActive(group.id)}
                  title={group.active ? 'Disable group (hide all from agent)' : 'Enable group'}
                  className={cn('h-5 w-5 flex items-center justify-center rounded transition-colors shrink-0',
                    group.active ? 't-muted hover:t-text' : 'text-red-400 hover:text-red-300')}>
                  {group.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
              </div>
            )
          })}

          {addingGroup && (
            <InlineInput placeholder="Group name…"
              onSubmit={n => { onAddGroup(n); setAddingGroup(false) }}
              onCancel={() => setAddingGroup(false)} />
          )}
        </>
      )}

      {/* ── Filter by type ───────────────────────────────────────── */}
      <div className="mt-4 mb-1 px-3">
        <p className="text-[10px] uppercase tracking-widest t-muted">Filter by type</p>
      </div>
      {(['all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill'] as const).map(f => {
        const count = f === 'all' ? total : categoryCounts[f] ?? 0
        const active = categoryFilter === f
        return (
          <button key={f} onClick={() => onCategoryFilter(f)}
            className={cn('mx-1 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs w-[calc(100%-8px)] text-left transition-colors',
              active ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-card hover:t-text')}>
            <span className={cn('shrink-0', active ? 't-accent' : 't-muted')}>{CATEGORY_ICONS[f]}</span>
            <span className="flex-1">{f === 'all' ? 'All types' : CATEGORY_LABELS[f]}</span>
            <span className={cn('text-[10px] tabular-nums', active ? 't-accent' : 't-muted')}>{count}</span>
          </button>
        )
      })}
    </aside>
  )
}
