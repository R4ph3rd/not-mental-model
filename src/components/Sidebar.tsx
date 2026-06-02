import { useState, useRef } from 'react'
import {
  Brain, MessageSquare, Lightbulb, Heart, Target, Zap,
  Eye, EyeOff, ChevronDown, ChevronRight, Folder, X,
  FolderPlus, MessageSquarePlus,
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
          if (e.key === 'Enter' && v.trim()) onSubmit(v.trim())
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => { if (v.trim()) onSubmit(v.trim()); else onCancel() }}
      />
      <button onClick={onCancel} className="t-muted hover:t-text"><X className="h-3 w-3" /></button>
    </div>
  )
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  // Convert hsl string to #rrggbb for the native picker (best-effort)
  function hslToHex(hsl: string): string {
    try {
      const m = hsl.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%/)
      if (!m) return '#6366f1'
      const h = parseInt(m[1]) / 360, s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100
      const a = s * Math.min(l, 1 - l)
      const f = (n: number) => {
        const k = (n + h * 12) % 12
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      }
      return `#${f(0).toString(16).padStart(2,'0')}${f(8).toString(16).padStart(2,'0')}${f(4).toString(16).padStart(2,'0')}`
    } catch { return '#6366f1' }
  }
  function hexToHsl(hex: string): string {
    const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255
    const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2
    if (max === min) return `hsl(0 0% ${Math.round(l*100)}%)`
    const d = max-min, s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    const h = max===r ? (g-b)/d+(g<b?6:0) : max===g ? (b-r)/d+2 : (r-g)/d+4
    return `hsl(${Math.round(h/6*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%)`
  }
  return (
    <button
      className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white/20 hover:ring-white/50 transition-all cursor-pointer"
      style={{ backgroundColor: color }}
      title="Click to change color"
      onClick={e => { e.stopPropagation(); ref.current?.click() }}
    >
      <input ref={ref} type="color" className="sr-only" value={hslToHex(color)}
        onChange={e => onChange(hexToHsl(e.target.value))} />
    </button>
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
  onAddGroup: (name: string, parentId?: string) => void
  onToggleGroupActive: (id: string) => void
  onUpdateProject: (id: string, data: { name?: string; color?: string }) => void
  onUpdateGroup: (id: string, data: { name?: string; color?: string }) => void
}

export function Sidebar({
  nodes, activeCount,
  categoryFilter, projectFilter, conversationFilter, groupFilter,
  projects, conversations, groups,
  onCategoryFilter, onProjectFilter, onConversationFilter, onGroupFilter,
  onAddProject, onAddConversation, onAddGroup, onToggleGroupActive,
  onUpdateProject, onUpdateGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(projects.map(p => p.id)))
  const [addingConvIn, setAddingConvIn] = useState<string | null>(null)
  const [addingGroupIn, setAddingGroupIn] = useState<string | null>(null)  // parentId or 'root'
  const [addingRootProject, setAddingRootProject] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)

  function toggleExpanded(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const total = nodes.length
  const noFilter = !projectFilter && !conversationFilter && !groupFilter
  const countByProject = (pid: string) => nodes.filter(n => n.projectId === pid).length
  const countByConv = (cid: string) => nodes.filter(n => n.conversationIds.includes(cid)).length
  const countByGroup = (gid: string) => nodes.filter(n => n.groupIds.includes(gid)).length
  const categoryCounts = {} as Record<NodeCategory, number>
  for (const n of nodes) categoryCounts[n.category] = (categoryCounts[n.category] ?? 0) + 1

  // Root-level groups: MemoryGroups without a parentId that references a project
  const rootGroups = groups.filter(g => !g.parentId)
  // Sub-groups of a given parent
  const subGroups = (parentId: string) => groups.filter(g => g.parentId === parentId)

  function renameProject(id: string, name: string) { onUpdateProject(id, { name }); setRenamingId(null) }
  function renameGroup(id: string, name: string) { onUpdateGroup(id, { name }); setRenamingId(null) }

  // Merge projects + root groups sorted by createdAt for unified tree
  type WorkspaceItem = { kind: 'project'; data: Project } | { kind: 'group'; data: MemoryGroup }
  const workspaceItems: WorkspaceItem[] = [
    ...projects.map(p => ({ kind: 'project' as const, data: p })),
    ...rootGroups.map(g => ({ kind: 'group' as const, data: g })),
  ].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt))

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

      {/* ── Knowledge workspace ──────────────────────────────────── */}
      <div className="mt-3 mb-1 px-3 flex items-center gap-1">
        <button onClick={() => setWorkspaceExpanded(v => !v)}
          className="flex items-center gap-1 t-muted hover:t-text transition-colors flex-1 min-w-0">
          {workspaceExpanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
          <p className="text-[10px] uppercase tracking-widest truncate">Knowledge workspace</p>
        </button>
        {/* Root-level action buttons */}
        <button onClick={() => setAddingRootProject(true)} className="t-muted hover:t-accent transition-colors" title="New group">
          <FolderPlus className="h-3 w-3" />
        </button>
      </div>

      {workspaceExpanded && (
        <>
          {workspaceItems.map(item => {
            if (item.kind === 'project') {
              const project = item.data
              const convs = conversations.filter(c => c.projectId === project.id)
              const subs = subGroups(project.id)
              const isOpen = expanded.has(project.id)
              const isActive = projectFilter === project.id && !conversationFilter

              return (
                <div key={project.id}>
                  <div className={cn('mx-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                    isActive ? 't-accent-subtle' : 'hover:t-card')}>
                    <button onClick={() => toggleExpanded(project.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <ColorDot color={project.color} onChange={c => onUpdateProject(project.id, { color: c })} />
                    {renamingId === project.id ? (
                      <input autoFocus defaultValue={project.name}
                        className="flex-1 bg-transparent border-b t-border text-xs t-text outline-none min-w-0"
                        onKeyDown={e => {
                          if (e.key === 'Enter') renameProject(project.id, (e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={e => renameProject(project.id, e.target.value)}
                      />
                    ) : (
                      <button onClick={() => { onProjectFilter(project.id); onConversationFilter(null); onGroupFilter(null) }}
                        onDoubleClick={e => { e.stopPropagation(); setRenamingId(project.id) }}
                        className="flex items-center gap-1 flex-1 min-w-0 text-left">
                        <span className={cn('flex-1 truncate font-medium', isActive ? 't-accent' : 't-text')}>{project.name}</span>
                        <span className={cn('tabular-nums text-[10px] shrink-0', isActive ? 't-accent' : 't-muted')}>{countByProject(project.id)}</span>
                      </button>
                    )}
                    {/* Hover actions */}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setAddingConvIn(project.id)} className="t-muted hover:t-accent transition-colors" title="New conversation">
                        <MessageSquarePlus className="h-3 w-3" />
                      </button>
                      <button onClick={() => setAddingGroupIn(project.id)} className="t-muted hover:t-accent transition-colors" title="New sub-group">
                        <FolderPlus className="h-3 w-3" />
                      </button>
                    </div>
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

                      {/* Sub-groups of this project */}
                      {subs.map(sub => {
                        const isSubFilter = groupFilter === sub.id
                        return (
                          <div key={sub.id}
                            className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors group',
                              isSubFilter ? 't-accent-subtle' : 'hover:t-card')}>
                            <ColorDot color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
                            {renamingId === sub.id ? (
                              <input autoFocus defaultValue={sub.name}
                                className="flex-1 bg-transparent border-b t-border text-xs t-text outline-none min-w-0"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renameGroup(sub.id, (e.target as HTMLInputElement).value)
                                  if (e.key === 'Escape') setRenamingId(null)
                                }}
                                onBlur={e => renameGroup(sub.id, e.target.value)}
                              />
                            ) : (
                              <button onClick={() => { onGroupFilter(isSubFilter ? null : sub.id); onProjectFilter(null); onConversationFilter(null) }}
                                onDoubleClick={e => { e.stopPropagation(); setRenamingId(sub.id) }}
                                className="flex items-center gap-1 flex-1 min-w-0 text-left">
                                <span className={cn('flex-1 truncate', isSubFilter ? 't-accent font-medium' : 't-muted group-hover:t-text')}>{sub.name}</span>
                                <span className="text-[10px] t-muted tabular-nums shrink-0">{countByGroup(sub.id)}</span>
                              </button>
                            )}
                            <button onClick={() => onToggleGroupActive(sub.id)} className={cn('h-4 w-4 flex items-center justify-center rounded shrink-0 transition-colors', sub.active ? 't-muted hover:t-text' : 'text-red-400')}>
                              {sub.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                            </button>
                          </div>
                        )
                      })}

                      {addingConvIn === project.id && (
                        <InlineInput placeholder="Conversation title…"
                          onSubmit={t => { onAddConversation(project.id, t); setAddingConvIn(null) }}
                          onCancel={() => setAddingConvIn(null)} />
                      )}
                      {addingGroupIn === project.id && (
                        <InlineInput placeholder="Sub-group name…"
                          onSubmit={n => { onAddGroup(n, project.id); setAddingGroupIn(null) }}
                          onCancel={() => setAddingGroupIn(null)} />
                      )}
                    </div>
                  )}
                </div>
              )
            }

            // kind === 'group' (root-level MemoryGroup without parentId)
            const group = item.data
            const isGroupFilter = groupFilter === group.id
            const subs = subGroups(group.id)
            const isOpen = expanded.has(group.id)

            return (
              <div key={group.id}>
                <div className={cn('mx-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                  isGroupFilter ? 't-accent-subtle' : 'hover:t-card')}>
                  {subs.length > 0 && (
                    <button onClick={() => toggleExpanded(group.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                  {subs.length === 0 && <span className="w-3 shrink-0" />}
                  <ColorDot color={group.color} onChange={c => onUpdateGroup(group.id, { color: c })} />
                  {renamingId === group.id ? (
                    <input autoFocus defaultValue={group.name}
                      className="flex-1 bg-transparent border-b t-border text-xs t-text outline-none min-w-0"
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameGroup(group.id, (e.target as HTMLInputElement).value)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onBlur={e => renameGroup(group.id, e.target.value)}
                    />
                  ) : (
                    <button onClick={() => { onGroupFilter(isGroupFilter ? null : group.id); onProjectFilter(null); onConversationFilter(null) }}
                      onDoubleClick={e => { e.stopPropagation(); setRenamingId(group.id) }}
                      className="flex items-center gap-1 flex-1 min-w-0 text-left">
                      <span className={cn('flex-1 truncate', isGroupFilter ? 't-accent font-medium' : 't-muted group-hover:t-text')}>{group.name}</span>
                      <span className="text-[10px] t-muted tabular-nums shrink-0">{countByGroup(group.id)}</span>
                    </button>
                  )}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setAddingGroupIn(group.id)} className="t-muted hover:t-accent transition-colors" title="New sub-group">
                      <FolderPlus className="h-3 w-3" />
                    </button>
                  </div>
                  <button onClick={() => onToggleGroupActive(group.id)} className={cn('h-4 w-4 flex items-center justify-center rounded shrink-0 transition-colors', group.active ? 't-muted hover:t-text' : 'text-red-400')}>
                    {group.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                  </button>
                </div>

                {isOpen && subs.length > 0 && (
                  <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-1.5 px-2 py-1 text-[11px] t-muted">
                        <ColorDot color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
                        <span className="flex-1 truncate">{sub.name}</span>
                        <span className="text-[10px] tabular-nums">{countByGroup(sub.id)}</span>
                      </div>
                    ))}
                    {addingGroupIn === group.id && (
                      <InlineInput placeholder="Sub-group name…"
                        onSubmit={n => { onAddGroup(n, group.id); setAddingGroupIn(null) }}
                        onCancel={() => setAddingGroupIn(null)} />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {addingRootProject && (
            <InlineInput placeholder="Group name…"
              onSubmit={n => { onAddProject(n); setAddingRootProject(false) }}
              onCancel={() => setAddingRootProject(false)} />
          )}
          {addingGroupIn === 'root' && (
            <InlineInput placeholder="Group name…"
              onSubmit={n => { onAddGroup(n); setAddingGroupIn(null) }}
              onCancel={() => setAddingGroupIn(null)} />
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
