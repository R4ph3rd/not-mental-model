import { useState, useEffect, useRef } from 'react'
import {
  Brain, MessageSquare, Lightbulb, Heart, Target, Zap,
  Eye, EyeOff, ChevronDown, ChevronRight, Folder, X,
  FolderPlus, MessageSquarePlus, CirclePlus,
  Pencil, Trash2, Copy, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColorPicker } from '@/components/ColorPicker'
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

const CATEGORY_DOT: Record<NodeCategory, string> = {
  project:      '#60a5fa',
  conversation: '#a78bfa',
  fact:         '#4ade80',
  preference:   '#fb923c',
  goal:         '#f472b6',
  skill:        '#22d3ee',
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
  onEditNode: (id: string) => void
  onDeleteNode: (id: string) => void
  onDuplicateNode: (id: string) => void
  onDeleteProject: (id: string) => void
  onDeleteGroup: (id: string) => void
}

export function Sidebar({
  nodes, activeCount,
  categoryFilter, projectFilter, conversationFilter, groupFilter,
  projects, conversations, groups,
  onCategoryFilter, onProjectFilter, onConversationFilter, onGroupFilter,
  onAddProject, onAddConversation, onAddGroup, onToggleGroupActive,
  onUpdateProject, onUpdateGroup,
  onAddNode, onFocusNode, onEditNode,
  onDeleteNode, onDuplicateNode, onDeleteProject, onDeleteGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(projects.map(p => p.id)))
  const [addingConvIn, setAddingConvIn]     = useState<string | null>(null)
  const [addingGroupIn, setAddingGroupIn]   = useState<string | null>(null)
  const [addingRootProject, setAddingRootProject] = useState(false)
  const [renamingId, setRenamingId]         = useState<string | null>(null)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)
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

  // unified sorted list of projects + root groups
  type WItem = { kind: 'project'; data: Project } | { kind: 'group'; data: MemoryGroup }
  const workspaceItems: WItem[] = [
    ...projects.map(p  => ({ kind: 'project' as const, data: p })),
    ...rootGroups.map(g => ({ kind: 'group'   as const, data: g })),
  ].sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt))

  // root nodes — no project and no groups
  const rootNodes = nodes.filter(n => !n.projectId && n.groupIds.length === 0)

  // node rows — compact display inside the tree
  function NodeRow({ node, parentProjectId }: { node: MentalModelNode; parentProjectId?: string }) {
    return (
      <div className="group/node flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] t-muted hover:t-text hover:t-card transition-colors cursor-pointer"
        onClick={() => onFocusNode(node.id)}
        onContextMenu={e => openCtx(e, 'node', node.id, parentProjectId)}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_DOT[node.category] }} />
        <span className="flex-1 truncate">{node.title}</span>
        <button className="hidden group-hover/node:flex t-muted hover:text-red-400 transition-colors shrink-0"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDeleteNode(node.id) }}
          title="Delete">
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    )
  }

  return (
    <aside className="w-56 shrink-0 border-r t-border t-sidebar flex flex-col py-3 overflow-y-auto">

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
      <div className="mt-3 mb-1 px-3 flex items-center gap-1 group/ws">
        <button onClick={() => setWorkspaceExpanded(v => !v)}
          className="flex items-center gap-1 t-muted hover:t-text transition-colors flex-1 min-w-0">
          {workspaceExpanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
          <p className="text-[10px] uppercase tracking-widest truncate">Knowledge workspace</p>
        </button>
        {/* Root action buttons — always visible on header */}
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

              // nodes directly in the project (not in any of the project's conversations)
              const projectConvIds = new Set(convs.map(c => c.id))
              const directNodes    = nodes.filter(n =>
                n.projectId === project.id &&
                !n.conversationIds.some(cid => projectConvIds.has(cid))
              )

              return (
                <div key={project.id}>
                  <div className={cn('mx-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                    isActive ? 't-accent-subtle' : 'hover:t-card')}
                    onContextMenu={e => openCtx(e, 'project', project.id)}>
                    <button onClick={() => toggleExpanded(project.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <ColorPicker color={project.color} onChange={c => onUpdateProject(project.id, { color: c })} />
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
                      </button>
                    )}
                    {/* Hover: show action icons, hide count */}
                    <span className={cn('tabular-nums text-[10px] shrink-0 group-hover:hidden', isActive ? 't-accent' : 't-muted')}>
                      {nodes.filter(n => n.projectId === project.id).length}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
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

                  {isOpen && (
                    <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                      {convs.map(conv => {
                        const isConvActive = conversationFilter === conv.id
                        const convNodes    = nodes.filter(n =>
                          n.projectId === project.id && n.conversationIds.includes(conv.id)
                        )
                        return (
                          <div key={conv.id}>
                            <div className={cn('flex items-center gap-1.5 rounded-md text-left transition-colors group/conv',
                              isConvActive ? 't-accent-subtle' : 'hover:t-card')}>
                              <button
                                onClick={() => { onProjectFilter(project.id); onConversationFilter(conv.id); onGroupFilter(null) }}
                                className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1">
                                <MessageSquare className={cn('h-3 w-3 shrink-0', isConvActive ? 't-accent' : 't-muted')} />
                                <span className={cn('flex-1 truncate text-[11px]', isConvActive ? 't-accent font-medium' : 't-muted group-hover/conv:t-text')}>
                                  {conv.title}
                                </span>
                              </button>
                              <span className="text-[10px] t-muted tabular-nums shrink-0 pr-1 group-hover/conv:hidden">{convNodes.length}</span>
                              <button className="hidden group-hover/conv:flex t-muted hover:t-accent pr-1 transition-colors shrink-0" title="New node"
                                onClick={() => onAddNode({ projectId: project.id, conversationId: conv.id })}>
                                <CirclePlus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            {convNodes.map(n => <NodeRow key={n.id} node={n} parentProjectId={project.id} />)}
                          </div>
                        )
                      })}

                      {/* Sub-groups */}
                      {subs.map(sub => {
                        const isSubFilter = groupFilter === sub.id
                        return (
                          <div key={sub.id}
                            className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors group/sub',
                              isSubFilter ? 't-accent-subtle' : 'hover:t-card')}>
                            <ColorPicker color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
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
                                <span className={cn('flex-1 truncate', isSubFilter ? 't-accent font-medium' : 't-muted group-hover/sub:t-text')}>{sub.name}</span>
                              </button>
                            )}
                            <span className="text-[10px] t-muted tabular-nums shrink-0 group-hover/sub:hidden">
                              {nodes.filter(n => n.groupIds.includes(sub.id)).length}
                            </span>
                            <div className="hidden group-hover/sub:flex items-center gap-0.5 shrink-0">
                              <button onClick={() => onAddNode({ groupId: sub.id })} className="t-muted hover:t-accent transition-colors" title="New node">
                                <CirclePlus className="h-2.5 w-2.5" />
                              </button>
                              <button onClick={() => onToggleGroupActive(sub.id)} className={cn('transition-colors', sub.active ? 't-muted hover:t-text' : 'text-red-400')}>
                                {sub.active ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {/* Direct project nodes (not in any conversation) */}
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
            const group       = item.data
            const isGroupFilter = groupFilter === group.id
            const subs        = subGroups(group.id)
            const isOpen      = expanded.has(group.id)
            const groupNodes  = nodes.filter(n => n.groupIds.includes(group.id) && !n.projectId)

            return (
              <div key={group.id}>
                <div className={cn('mx-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs w-[calc(100%-8px)] transition-colors group',
                  isGroupFilter ? 't-accent-subtle' : 'hover:t-card')}
                  onContextMenu={e => openCtx(e, 'group', group.id)}>
                  {(subs.length > 0 || groupNodes.length > 0) ? (
                    <button onClick={() => toggleExpanded(group.id)} className="t-muted hover:t-text shrink-0">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  ) : <span className="w-3 shrink-0" />}
                  <ColorPicker color={group.color} onChange={c => onUpdateGroup(group.id, { color: c })} />
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
                    </button>
                  )}
                  <span className={cn('tabular-nums text-[10px] shrink-0 group-hover:hidden', isGroupFilter ? 't-accent' : 't-muted')}>
                    {groupNodes.length}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
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

                {isOpen && (subs.length > 0 || groupNodes.length > 0) && (
                  <div className="ml-4 border-l t-border pl-2 pb-1 space-y-0.5">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-1.5 px-2 py-1 text-[11px] t-muted">
                        <ColorPicker color={sub.color} onChange={c => onUpdateGroup(sub.id, { color: c })} />
                        <span className="flex-1 truncate">{sub.name}</span>
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

          {/* Root nodes — no project and no groups */}
          {rootNodes.map(n => <NodeRow key={n.id} node={n} />)}

          {addingRootProject && (
            <InlineInput placeholder="Group name…"
              onSubmit={n => { onAddProject(n); setAddingRootProject(false) }}
              onCancel={() => setAddingRootProject(false)} />
          )}
        </>
      )}

      {/* ── Filter by type ───────────────────────────────────────── */}
      <div className="mt-4 mb-1 px-3">
        <p className="text-[10px] uppercase tracking-widest t-muted">Filter by type</p>
      </div>
      {(['all', 'project', 'conversation', 'fact', 'preference', 'goal', 'skill'] as const).map(f => {
        const count  = f === 'all' ? total : categoryCounts[f] ?? 0
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
