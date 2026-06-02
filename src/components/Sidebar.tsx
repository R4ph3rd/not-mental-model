import { useState, useEffect, useRef } from 'react'
import {
  Brain, MessageSquare, Lightbulb, Heart, Target, Zap,
  Eye, EyeOff, ChevronDown, ChevronRight, Folder, X,
  FolderPlus, MessageSquarePlus, CirclePlus,
  Pencil, Trash2, Copy, Navigation, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeCategory, Project, Conversation, MemoryGroup, MentalModelNode } from '@/types/mental-model'
import { CATEGORY_LABELS } from '@/types/mental-model'

const PRESETS = [
  'hsl(0 65% 55%)',   'hsl(20 70% 55%)',  'hsl(45 70% 55%)',  'hsl(85 55% 45%)',
  'hsl(150 55% 45%)', 'hsl(195 65% 52%)', 'hsl(220 65% 58%)', 'hsl(235 70% 62%)',
  'hsl(255 65% 62%)', 'hsl(285 65% 58%)', 'hsl(315 65% 58%)', 'hsl(330 65% 58%)',
]

function darkenHsl(hsl: string, amount = 20): string {
  return hsl.replace(/(\d+)%\s*\)$/, (_m, l) => `${Math.max(0, parseInt(l) - amount)}%)`)
}

const CATEGORY_ICONS: Record<NodeCategory | 'all', React.ReactNode> = {
  all:          <Brain className="h-3.5 w-3.5" />,
  project:      <Folder className="h-3.5 w-3.5" />,
  conversation: <MessageSquare className="h-3.5 w-3.5" />,
  fact:         <Lightbulb className="h-3.5 w-3.5" />,
  preference:   <Heart className="h-3.5 w-3.5" />,
  goal:         <Target className="h-3.5 w-3.5" />,
  skill:        <Zap className="h-3.5 w-3.5" />,
}

function GroupIconButton({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const bgColor   = color.replace(')', ' / 0.18)')
  const iconColor = darkenHsl(color, 20)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className="h-5 w-5 rounded-md flex items-center justify-center ring-1 ring-white/10 hover:ring-white/30 transition-all"
        style={{ backgroundColor: bgColor }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        title="Change color"
      >
        <Folder className="h-3 w-3 shrink-0" style={{ color: iconColor }} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 p-2 t-ui border t-border rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 w-max">
          {PRESETS.map(c => (
            <button
              key={c}
              className="h-5 w-5 rounded-full hover:scale-110 transition-transform ring-1 ring-white/10"
              style={{ backgroundColor: c, outline: c === color ? '2px solid white' : 'none', outlineOffset: '2px' }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onChange(c); setOpen(false) }}
            />
          ))}
        </div>
      )}
    </div>
  )
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

interface Props {
  nodes: MentalModelNode[]
  activeCount: number
  categoryFilter: NodeCategory | 'all'
  projectFilter: string | null
  conversationFilter: string | null
  groupFilter: string | null
  selectedNodeIds: Set<string>
  projects: Project[]
  conversations: Conversation[]
  groups: MemoryGroup[]
  onCategoryFilter: (f: NodeCategory | 'all') => void
  onProjectFilter: (id: string | null) => void
  onConversationFilter: (id: string | null) => void
  onGroupFilter: (id: string | null) => void
  onAddProject: (name: string) => Project
  onAddConversation: (projectId: string, title: string) => void
  onAddGroup: (name: string, parentId?: string) => void
  onToggleGroupActive: (id: string) => void
  onUpdateProject: (id: string, data: { name?: string; color?: string }) => void
  onUpdateGroup: (id: string, data: { name?: string; color?: string }) => void
  onAddNode: (ctx: { projectId?: string; conversationId?: string; groupId?: string }) => void
  onFocusNode: (id: string) => void
  onFocusGroup: (id: string) => void
  onEditNode: (id: string) => void
  onDeleteNode: (id: string) => void
  onDuplicateNode: (id: string) => void
  onDeleteProject: (id: string) => void
  onDeleteGroup: (id: string) => void
}

export function Sidebar({
  nodes, activeCount,
  categoryFilter, projectFilter, conversationFilter, groupFilter,
  selectedNodeIds,
  projects, conversations, groups,
  onCategoryFilter, onProjectFilter, onConversationFilter, onGroupFilter,
  onAddProject, onAddConversation, onAddGroup, onToggleGroupActive,
  onUpdateProject, onUpdateGroup,
  onAddNode, onFocusNode, onFocusGroup, onEditNode,
  onDeleteNode, onDuplicateNode, onDeleteProject, onDeleteGroup,
}: Props) {
  const [expanded, setExpanded]   = useState<Set<string>>(() => new Set(projects.map(p => p.id)))
  const [addingConvIn, setAddingConvIn]       = useState<string | null>(null)
  const [addingGroupIn, setAddingGroupIn]     = useState<string | null>(null)
  const [addingRootProject, setAddingRootProject] = useState(false)
  const [renamingId, setRenamingId]           = useState<string | null>(null)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)
  const [filterOpen, setFilterOpen]           = useState(false)
  const filterRef  = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number
    type: 'project' | 'group' | 'node'
    id: string
    parentProjectId?: string
  } | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    function close(e: MouseEvent) {
      if (!ctxMenuRef.current?.contains(e.target as Node)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [!!ctxMenu])

  useEffect(() => {
    if (!filterOpen) return
    function close(e: MouseEvent) {
      if (!filterRef.current?.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [filterOpen])

  function openCtx(e: React.MouseEvent, type: 'project' | 'group' | 'node', id: string, parentProjectId?: string) {
    e.preventDefault(); e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth  - 200)
    const y = Math.min(e.clientY, window.innerHeight - 220)
    setCtxMenu({ x, y, type, id, parentProjectId })
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const total      = nodes.length
  const noFilter   = !projectFilter && !conversationFilter && !groupFilter
  const rootGroups = groups.filter(g => !g.parentId)
  const subGroups  = (pid: string) => groups.filter(g => g.parentId === pid)

  const categoryCounts = {} as Record<NodeCategory, number>
  for (const n of nodes) categoryCounts[n.category] = (categoryCounts[n.category] ?? 0) + 1

  function renameProject(id: string, name: string) { onUpdateProject(id, { name }); setRenamingId(null) }
  function renameGroup(id: string, name: string)   { onUpdateGroup(id, { name });   setRenamingId(null) }

  type WItem = { kind: 'project'; data: Project } | { kind: 'group'; data: MemoryGroup }
  const workspaceItems: WItem[] = [
    ...projects.map(p  => ({ kind: 'project' as const, data: p })),
    ...rootGroups.map(g => ({ kind: 'group'   as const, data: g })),
  ].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt))

  const rootNodes = nodes.filter(n => !n.projectId && n.groupIds.length === 0)

  function NodeRow({ node, parentProjectId }: { node: MentalModelNode; parentProjectId?: string }) {
    const isSelected = selectedNodeIds.has(node.id)
    return (
      <div
        className={cn(
          'group/node flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer',
          isSelected ? 't-accent-subtle t-accent' : 't-muted hover:t-text hover:t-card',
        )}
        onClick={() => onFocusNode(node.id)}
        onContextMenu={e => openCtx(e, 'node', node.id, parentProjectId)}
      >
        <span className="flex-1 truncate text-left">{node.title}</span>
        <button
          className="hidden group-hover/node:block t-muted hover:text-red-400 transition-colors shrink-0"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDeleteNode(node.id) }}
          title="Delete"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-64 shrink-0 border-r t-border t-sidebar flex flex-col py-3 overflow-y-auto pr-2">

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

      {/* All nodes + filter dropdown */}
      <div ref={filterRef} className="relative mx-1">
        <div className={cn(
          'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs w-full transition-colors',
          noFilter ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-card hover:t-text',
        )}>
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            onClick={() => { onProjectFilter(null); onConversationFilter(null); onGroupFilter(null) }}
          >
            <Brain className={cn('h-3.5 w-3.5 shrink-0', noFilter ? 't-accent' : '')} />
            <span className="flex-1">All nodes</span>
            <span className="tabular-nums text-[10px]">{total}</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); setFilterOpen(v => !v) }}
            className={cn(
              'shrink-0 rounded p-0.5 hover:t-text transition-colors ml-1',
              categoryFilter !== 'all' ? 't-accent' : 't-muted',
            )}
            title="Filter by type"
          >
            <SlidersHorizontal className="h-3 w-3" />
          </button>
        </div>
        {filterOpen && (
          <div className="absolute left-0 top-full mt-1 z-[100] t-ui border t-border rounded-xl shadow-2xl py-1 w-full min-w-[180px]">
            {(['all', 'fact', 'preference', 'goal', 'skill', 'project', 'conversation'] as const).map(f => {
              const count  = f === 'all' ? total : (categoryCounts[f] ?? 0)
              const active = categoryFilter === f
              return (
                <button key={f}
                  onClick={() => { onCategoryFilter(f); setFilterOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left',
                    active ? 't-accent font-medium t-accent-subtle' : 't-muted hover:t-text hover:t-accent-subtle',
                  )}>
                  <span className="shrink-0">{CATEGORY_ICONS[f]}</span>
                  <span className="flex-1">{f === 'all' ? 'All types' : CATEGORY_LABELS[f]}</span>
                  <span className="tabular-nums text-[10px]">{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Knowledge workspace ──────────────────────────────────── */}
      <div className="mt-3 mb-1 px-3 flex items-center gap-1">
        <button onClick={() => setWorkspaceExpanded(v => !v)}
          className="flex items-center gap-1 t-muted hover:t-text transition-colors flex-1 min-w-0">
          {workspaceExpanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
          <p className="text-[10px] uppercase tracking-widest truncate">Knowledge workspace</p>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onAddNode({})} className="t-muted hover:t-accent transition-colors" title="New node">
            <CirclePlus className="h-3 w-3" />
          </button>
          <button onClick={() => {
            const proj = onAddProject('New project')
            setExpanded(prev => new Set([...prev, proj.id]))
            setAddingConvIn(proj.id)
          }} className="t-muted hover:t-accent transition-colors" title="New conversation">
            <MessageSquarePlus className="h-3 w-3" />
          </button>
          <button onClick={() => setAddingRootProject(true)} className="t-muted hover:t-accent transition-colors" title="New group">
            <FolderPlus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {workspaceExpanded && (
        <>
          {workspaceItems.map(item => {
            if (item.kind === 'project') {
              const project  = item.data
              const convs    = conversations.filter(c => c.projectId === project.id)
              const subs     = subGroups(project.id)
              const isOpen   = expanded.has(project.id)
              const isActive = projectFilter === project.id && !conversationFilter

              const projectConvIds = new Set(convs.map(c => c.id))
              const directNodes    = nodes.filter(n =>
                n.projectId === project.id &&
                !n.conversationIds.some(cid => projectConvIds.has(cid))
              )

              return (
                <div key={project.id}>
                  <div className={cn(
                    'mx-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                    isActive ? 't-accent-subtle' : 'hover:t-card',
                  )} onContextMenu={e => openCtx(e, 'project', project.id)}>
                    <button onClick={() => toggleExpanded(project.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <GroupIconButton color={project.color} onChange={c => onUpdateProject(project.id, { color: c })} />
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
                      <button
                        onClick={() => { onProjectFilter(project.id); onConversationFilter(null); onGroupFilter(null) }}
                        onDoubleClick={e => { e.stopPropagation(); setRenamingId(project.id) }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className={cn('block truncate font-medium', isActive ? 't-accent' : 't-text')}>{project.name}</span>
                      </button>
                    )}
                    {/* Right slot: count fades, actions appear on hover */}
                    <div className="relative shrink-0 flex justify-end" style={{ minWidth: '52px' }}>
                      <span className={cn('tabular-nums text-[10px] group-hover:opacity-0 transition-opacity', isActive ? 't-accent' : 't-muted')}>
                        {nodes.filter(n => n.projectId === project.id).length}
                      </span>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                        <button onClick={() => onAddNode({ projectId: project.id })} className="t-muted hover:t-accent transition-colors" title="New node">
                          <CirclePlus className="h-3 w-3" />
                        </button>
                        <button onClick={() => { setAddingConvIn(project.id); if (!isOpen) toggleExpanded(project.id) }}
                          className="t-muted hover:t-accent transition-colors" title="New conversation">
                          <MessageSquarePlus className="h-3 w-3" />
                        </button>
                        <button onClick={() => { setAddingGroupIn(project.id); if (!isOpen) toggleExpanded(project.id) }}
                          className="t-muted hover:t-accent transition-colors" title="New sub-group">
                          <FolderPlus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                      {convs.map(conv => {
                        const isConvActive = conversationFilter === conv.id
                        const convNodes = nodes.filter(n =>
                          n.projectId === project.id && n.conversationIds.includes(conv.id)
                        )
                        return (
                          <div key={conv.id}>
                            <div className={cn(
                              'flex items-center rounded-md transition-colors group/conv',
                              isConvActive ? 't-accent-subtle' : 'hover:t-card',
                            )}>
                              <button
                                onClick={() => { onProjectFilter(project.id); onConversationFilter(conv.id); onGroupFilter(null) }}
                                className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 text-left"
                              >
                                <MessageSquare className={cn('h-3 w-3 shrink-0', isConvActive ? 't-accent' : 't-muted')} />
                                <span className={cn('flex-1 truncate text-[11px] text-left', isConvActive ? 't-accent font-medium' : 't-muted group-hover/conv:t-text')}>
                                  {conv.title}
                                </span>
                              </button>
                              <div className="relative shrink-0 pr-2 flex justify-end" style={{ minWidth: '28px' }}>
                                <span className="text-[10px] t-muted tabular-nums group-hover/conv:opacity-0 transition-opacity">{convNodes.length}</span>
                                <button
                                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/conv:opacity-100 transition-opacity t-muted hover:t-accent pointer-events-none group-hover/conv:pointer-events-auto"
                                  title="New node"
                                  onClick={() => onAddNode({ projectId: project.id, conversationId: conv.id })}
                                >
                                  <CirclePlus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            {convNodes.map(n => <NodeRow key={n.id} node={n} parentProjectId={project.id} />)}
                          </div>
                        )
                      })}

                      {subs.map(sub => {
                        const isSubFilter = groupFilter === sub.id
                        return (
                          <div key={sub.id} className={cn(
                            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors group/sub',
                            isSubFilter ? 't-accent-subtle' : 'hover:t-card',
                          )}>
                            <GroupIconButton color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
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
                              <button
                                onClick={() => { onGroupFilter(isSubFilter ? null : sub.id); onProjectFilter(null); onConversationFilter(null); onFocusGroup(sub.id) }}
                                onDoubleClick={e => { e.stopPropagation(); setRenamingId(sub.id) }}
                                className="flex-1 min-w-0 text-left"
                              >
                                <span className={cn('block truncate', isSubFilter ? 't-accent font-medium' : 't-muted group-hover/sub:t-text')}>{sub.name}</span>
                              </button>
                            )}
                            <div className="relative shrink-0 flex justify-end" style={{ minWidth: '36px' }}>
                              <span className="text-[10px] t-muted tabular-nums group-hover/sub:opacity-0 transition-opacity">
                                {nodes.filter(n => n.groupIds.includes(sub.id)).length}
                              </span>
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity pointer-events-none group-hover/sub:pointer-events-auto">
                                <button onClick={() => onAddNode({ groupId: sub.id })} className="t-muted hover:t-accent transition-colors" title="New node">
                                  <CirclePlus className="h-3 w-3" />
                                </button>
                                <button onClick={() => onToggleGroupActive(sub.id)} className={cn('transition-colors', sub.active ? 't-muted hover:t-text' : 'text-red-400')}>
                                  {sub.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {directNodes.map(n => <NodeRow key={n.id} node={n} parentProjectId={project.id} />)}

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

            // Root MemoryGroup (no parentId)
            const group         = item.data
            const isGroupFilter = groupFilter === group.id
            const subs          = subGroups(group.id)
            const isOpen        = expanded.has(group.id)
            const groupNodes    = nodes.filter(n => n.groupIds.includes(group.id) && !n.projectId)

            return (
              <div key={group.id}>
                <div className={cn(
                  'mx-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                  isGroupFilter ? 't-accent-subtle' : 'hover:t-card',
                )} onContextMenu={e => openCtx(e, 'group', group.id)}>
                  {(subs.length > 0 || groupNodes.length > 0) ? (
                    <button onClick={() => toggleExpanded(group.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  ) : <span className="w-3 h-3 shrink-0" />}
                  <GroupIconButton color={group.color} onChange={c => onUpdateGroup(group.id, { color: c })} />
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
                    <button
                      onClick={() => { onGroupFilter(isGroupFilter ? null : group.id); onProjectFilter(null); onConversationFilter(null); onFocusGroup(group.id) }}
                      onDoubleClick={e => { e.stopPropagation(); setRenamingId(group.id) }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className={cn('block truncate', isGroupFilter ? 't-accent font-medium' : 't-muted group-hover:t-text')}>{group.name}</span>
                    </button>
                  )}
                  <div className="relative shrink-0 flex justify-end" style={{ minWidth: '52px' }}>
                    <span className={cn('tabular-nums text-[10px] group-hover:opacity-0 transition-opacity', isGroupFilter ? 't-accent' : 't-muted')}>
                      {groupNodes.length}
                    </span>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                      <button onClick={() => onAddNode({ groupId: group.id })} className="t-muted hover:t-accent transition-colors" title="New node">
                        <CirclePlus className="h-3 w-3" />
                      </button>
                      <button onClick={() => { setAddingGroupIn(group.id); if (!isOpen) toggleExpanded(group.id) }}
                        className="t-muted hover:t-accent transition-colors" title="New sub-group">
                        <FolderPlus className="h-3 w-3" />
                      </button>
                      <button onClick={() => onToggleGroupActive(group.id)} className={cn('transition-colors', group.active ? 't-muted hover:t-text' : 'text-red-400')}>
                        {group.active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (subs.length > 0 || groupNodes.length > 0) && (
                  <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-1.5 px-2 py-1 text-[11px] t-muted">
                        <GroupIconButton color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
                        <span className="flex-1 truncate text-left">{sub.name}</span>
                      </div>
                    ))}
                    {groupNodes.map(n => <NodeRow key={n.id} node={n} />)}
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

          {rootNodes.map(n => <NodeRow key={n.id} node={n} />)}

          {addingRootProject && (
            <InlineInput placeholder="Group name…"
              onSubmit={n => { onAddProject(n); setAddingRootProject(false) }}
              onCancel={() => setAddingRootProject(false)} />
          )}
        </>
      )}

      {/* ── Context menu ─────────────────────────────────────────── */}
      {ctxMenu && (
        <div ref={ctxMenuRef}
          className="fixed z-[200] t-ui border t-border rounded-xl shadow-2xl py-1 w-48 text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={e => e.stopPropagation()}>
          {ctxMenu.type === 'node' ? (<>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { onFocusNode(ctxMenu.id); setCtxMenu(null) }}>
              <Navigation className="h-3.5 w-3.5 shrink-0" />Find in canvas
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { onDuplicateNode(ctxMenu.id); setCtxMenu(null) }}>
              <Copy className="h-3.5 w-3.5 shrink-0" />Duplicate
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { onEditNode(ctxMenu.id); setCtxMenu(null) }}>
              <Pencil className="h-3.5 w-3.5 shrink-0" />Edit
            </button>
            <div className="border-t t-border my-1" />
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:text-red-400 transition-colors"
              onClick={() => { onDeleteNode(ctxMenu.id); setCtxMenu(null) }}>
              <Trash2 className="h-3.5 w-3.5 shrink-0" />Delete
            </button>
          </>) : ctxMenu.type === 'project' ? (<>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { onAddNode({ projectId: ctxMenu.id }); setCtxMenu(null) }}>
              <CirclePlus className="h-3.5 w-3.5 shrink-0" />New node
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { setAddingConvIn(ctxMenu.id); setCtxMenu(null) }}>
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />New conversation
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { setAddingGroupIn(ctxMenu.id); setCtxMenu(null) }}>
              <FolderPlus className="h-3.5 w-3.5 shrink-0" />New sub-group
            </button>
            <div className="border-t t-border my-1" />
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { setRenamingId(ctxMenu.id); setCtxMenu(null) }}>
              <Pencil className="h-3.5 w-3.5 shrink-0" />Rename
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:text-red-400 transition-colors"
              onClick={() => { onDeleteProject(ctxMenu.id); setCtxMenu(null) }}>
              <Trash2 className="h-3.5 w-3.5 shrink-0" />Delete
            </button>
          </>) : (<>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { onAddNode({ groupId: ctxMenu.id }); setCtxMenu(null) }}>
              <CirclePlus className="h-3.5 w-3.5 shrink-0" />New node
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { setAddingGroupIn(ctxMenu.id); setCtxMenu(null) }}>
              <FolderPlus className="h-3.5 w-3.5 shrink-0" />New sub-group
            </button>
            <div className="border-t t-border my-1" />
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:t-text hover:t-accent-subtle transition-colors"
              onClick={() => { setRenamingId(ctxMenu.id); setCtxMenu(null) }}>
              <Pencil className="h-3.5 w-3.5 shrink-0" />Rename
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 t-muted hover:text-red-400 transition-colors"
              onClick={() => { onDeleteGroup(ctxMenu.id); setCtxMenu(null) }}>
              <Trash2 className="h-3.5 w-3.5 shrink-0" />Delete
            </button>
          </>)}
        </div>
      )}
    </aside>
  )
}
