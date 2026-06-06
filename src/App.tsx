import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Sparkles, Search, Brain, Trash2, LayoutGrid, GitBranch, GitCommitHorizontal,
  Download, FolderInput, Settings, MessageSquare, Telescope, Bot,
  Network, FolderOpen, Server,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/Sidebar'
import { NodeCard } from '@/components/NodeCard'
import { ClaudeSync } from '@/components/ClaudeSync'
import { StatsBar } from '@/components/StatsBar'
import { StaleReviewPanel, staleCount } from '@/components/StaleReviewPanel'
import { CopyContextButton } from '@/components/CopyContextButton'
import { Canvas } from '@/components/canvas/Canvas'
import { GraphView } from '@/components/graph/GraphView'
import { Timeline } from '@/views/Timeline'
import { InspectorPanel } from '@/components/InspectorPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ChatPanel } from '@/components/ChatPanel'
import { Onboarding } from '@/components/Onboarding'
import { InferenceModal } from '@/components/InferenceModal'
import { McpExportModal } from '@/components/McpExportModal'
import type { InferenceMode } from '@/components/InferenceModal'
import { DedupReviewModal } from '@/components/DedupReviewModal'
import type { ResolvedAction } from '@/components/DedupReviewModal'
import { classifyIncoming } from '@/lib/dedup'
import type { ClassifiedNode } from '@/lib/dedup'
import { useMentalModelStore } from '@/store/mental-model-store'
import { callProvider, getDefaultProvider } from '@/lib/providers'
import type { NodeCategory, MentalModelNode } from '@/types/mental-model'

type View = 'grid' | 'canvas' | 'graph' | 'timeline'

export default function App() {
  const {
    nodes, addNode, updateNode, deleteNode,
    toggleActive, togglePin, confirmNode, setPosition,
    importNodes, addSummaryNode, bumpAccess,
    projects, addProject, updateProject, deleteProject,
    conversations, addConversation, updateConversation,
    groups, addGroup, updateGroup, deleteGroup, toggleGroupActive,
  } = useMentalModelStore()

  const [view, setView]                             = useState<View>('canvas')
  const [categoryFilter, setCategoryFilter]         = useState<NodeCategory | 'all'>('all')
  const [groupFilter, setGroupFilter]               = useState<string | null>(null)
  const [conversationFilter, setConversationFilter] = useState<string | null>(null)
  const [search, setSearch]                         = useState('')
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [aiOpen, setAiOpen]             = useState(false)
  const [mcpOpen, setMcpOpen]           = useState(false)
  const [aiTab, setAiTab]               = useState<'extract' | 'summarize'>('extract')
  const [inspectorId, setInspectorId]   = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen]         = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem('mm-onboarding-done'))
  const [inferMode, setInferMode] = useState<InferenceMode | null>(null)
  const [inferSourceNodes, setInferSourceNodes] = useState<typeof nodes | null>(null)
  const [canvasFocusId, setCanvasFocusId]           = useState<string | null>(null)
  const [canvasFocusGroupId, setCanvasFocusGroupId] = useState<string | null>(null)

  function openInfer(mode: InferenceMode, src?: typeof nodes) {
    setInferMode(mode)
    setInferSourceNodes(src ?? null)
  }

  function handleFocusNode(id: string) {
    setCanvasFocusId(id)
    setView(v => (v === 'canvas' || v === 'graph') ? v : 'canvas')
  }

  function handleFocusGroup(id: string) {
    setView('canvas')
    setCanvasFocusGroupId(id)
  }

  function handleSidebarAddNode(ctx: { groupId?: string; conversationId?: string }) {
    const targetProjectId = ctx.groupId && projects.some(p => p.id === ctx.groupId) ? ctx.groupId : undefined
    const extraGroupIds   = ctx.groupId && !targetProjectId ? [ctx.groupId] : []
    const n = addNode(
      { category: 'fact', title: '', content: '', tags: [], confidence: 'medium',
        source: '', memoryType: 'semantic', scope: '', importance: 0.5,
        provenance: 'user', confirmed: true, sensitive: false,
        groupIds: extraGroupIds },
      targetProjectId,
      ctx.conversationId ? [ctx.conversationId] : undefined,
    )
    if (ctx.groupId) setGroupFilter(ctx.groupId)
    if (ctx.conversationId) setConversationFilter(ctx.conversationId)
    setInspectorId(n.id)
  }

  function handleDuplicateNode(id: string) {
    const src = nodes.find(n => n.id === id)
    if (!src) return
    addNode({
      category: src.category,
      title: src.title + ' (copy)',
      content: src.content,
      tags: [...src.tags],
      confidence: src.confidence,
      source: src.source ?? '',
      memoryType: src.memoryType,
      scope: src.scope,
      importance: src.importance,
      provenance: src.provenance,
      confirmed: src.confirmed,
      sensitive: src.sensitive,
    }, src.projectId, src.conversationIds.length ? [...src.conversationIds] : undefined)
  }

  // Governance paper: inactive groups reduce effective active context
  const inactiveGroupIds = useMemo(
    () => new Set(groups.filter(g => !g.active).map(g => g.id)),
    [groups]
  )

  function isNodeVisibleToAgent(n: MentalModelNode) {
    if (!n.active) return false
    if (n.sensitive) return false
    if (n.groupIds.some(gid => inactiveGroupIds.has(gid))) return false
    return true
  }

  const filtered = useMemo(() => {
    let list = nodes
    if (conversationFilter) list = list.filter(n => n.conversationIds.includes(conversationFilter))
    else if (groupFilter) list = list.filter(n => n.projectId === groupFilter || n.groupIds.includes(groupFilter))
    if (categoryFilter !== 'all') list = list.filter(n => n.category === categoryFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [nodes, categoryFilter, conversationFilter, groupFilter, search])

  const activeCount   = useMemo(() => filtered.filter(isNodeVisibleToAgent).length, [filtered, inactiveGroupIds])
  const nStale        = useMemo(() => staleCount(nodes), [nodes])

  type GridSection = { id: string; name: string; color: string; items: MentalModelNode[] }
  const gridSections = useMemo((): GridSection[] | null => {
    if (groupFilter || conversationFilter) return null
    const sections: GridSection[] = []
    const claimed = new Set<string>()

    for (const proj of projects) {
      const items = filtered.filter(n => n.projectId === proj.id)
      if (items.length > 0) {
        sections.push({ id: proj.id, name: proj.name, color: proj.color, items })
        items.forEach(n => claimed.add(n.id))
      }
    }
    for (const grp of groups) {
      const items = filtered.filter(n => !claimed.has(n.id) && n.groupIds.includes(grp.id))
      if (items.length > 0) {
        sections.push({ id: grp.id, name: grp.name, color: grp.color, items })
        items.forEach(n => claimed.add(n.id))
      }
    }
    const ungrouped = filtered.filter(n => !claimed.has(n.id))
    if (ungrouped.length > 0) sections.push({ id: '__ungrouped', name: 'Ungrouped', color: '', items: ungrouped })
    return sections.length > 1 ? sections : null
  }, [filtered, projects, groups, groupFilter, conversationFilter])
  const selectedNodes = useMemo(() => nodes.filter(n => selectedIds.has(n.id)), [nodes, selectedIds])
  const inspectedNode = useMemo(() => nodes.find(n => n.id === inspectorId) ?? null, [nodes, inspectorId])

  const handleToggleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (multi) { if (next.has(id)) next.delete(id); else next.add(id) }
      else { if (next.has(id) && next.size === 1) next.clear(); else { next.clear(); next.add(id) } }
      return next
    })
  }, [])

  function handleExport() {
    const toExport = selectedIds.size > 0 ? selectedNodes : nodes
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `mental-model-${Date.now()}.json`; a.click()
  }

  function getLinkedNodes(ids: string[]) { return nodes.filter(n => ids.includes(n.id)) }

  // Xu 2025: distil fading episodic memory into a semantic node
  async function handleDistill(node: MentalModelNode) {
    const provider = getDefaultProvider()
    if (!provider) return
    try {
      const system = 'Extract the key reusable knowledge from this episodic memory. Return ONLY a JSON object {title, content, tags} — a concise semantic fact the user should remember long-term. No markdown.'
      const raw = await callProvider(provider, system, `Title: ${node.title}\nContent: ${node.content}`)
      const { title, content, tags } = JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim())
      addNode({
        category: 'fact', title, content,
        tags: Array.isArray(tags) ? tags : [],
        confidence: node.confidence, source: 'distilled',
        memoryType: 'semantic', scope: node.scope, importance: node.importance,
        provenance: 'extracted', confirmed: true,
      }, node.projectId, node.conversationIds)
      // Link original episodic → deactivate
      toggleActive(node.id)
    } catch { /* non-fatal */ }
  }

  // Chat / inference: auto-extracts nodes (Governance paper: provenance = 'agent')
  function doAddAgentNodes(
    raw: Array<{ title: string; content: string; category: NodeCategory; confidence: 'high' | 'medium' | 'low' }>,
    targetProject?: string,
    targetConvs?: string[],
  ) {
    for (const n of raw) {
      addNode({
        ...n, tags: [], source: 'chat-auto', memoryType: 'semantic',
        scope: '', importance: 0.7,
        provenance: 'agent', confirmed: false, sensitive: false,
      }, targetProject, targetConvs)
    }
  }

  function handleAgentNodes(raw: Array<{ title: string; content: string; category: NodeCategory; confidence: 'high' | 'medium' | 'low' }>) {
    let targetProject = groupFilter && projects.some(p => p.id === groupFilter) ? groupFilter : undefined
    if (!targetProject && inferMode === 'from-selection') {
      const counts: Record<string, number> = {}
      for (const n of selectedNodes) if (n.projectId) counts[n.projectId] = (counts[n.projectId] ?? 0) + 1
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top) targetProject = top[0]
    }
    const targetConvs = conversationFilter ? [conversationFilter] : undefined

    const { needsReview, clean } = classifyIncoming(
      raw.map(n => ({ ...n, tags: [], source: 'chat-auto', memoryType: 'semantic', scope: '', importance: 0.7 })),
      nodes,
    )
    // Add clean nodes immediately
    doAddAgentNodes(clean as typeof raw, targetProject, targetConvs)
    // Queue conflict/duplicate nodes for review
    if (needsReview.length > 0) {
      setPendingImport({
        classified: needsReview,
        cleanCount: clean.length,
        onApply: actions => applyDedupActions(actions, { targetProject, targetConvs }),
      })
    }
  }

  function handleImportWithDedup(incoming: import('@/types/mental-model').MentalModelNode[]) {
    const { needsReview, clean } = classifyIncoming(incoming, nodes)
    importNodes(clean as import('@/types/mental-model').MentalModelNode[])
    if (needsReview.length > 0) {
      setPendingImport({
        classified: needsReview,
        cleanCount: clean.length,
        onApply: actions => applyDedupActions(actions, {}),
      })
    }
  }

  function applyDedupActions(
    actions: ResolvedAction[],
    ctx: { targetProject?: string; targetConvs?: string[] },
  ) {
    for (const action of actions) {
      if (action.kind === 'skip') continue
      if (action.kind === 'replace' || action.kind === 'merge') {
        deleteNode(action.replaceId)
      }
      const nodeData = action.kind === 'merge' ? { ...action.base, ...action.merged } : action.node
      const n = nodeData as Record<string, unknown>
      addNode(
        {
          title:      (n.title as string)    ?? '',
          content:    (n.content as string)  ?? '',
          category:   (n.category as NodeCategory) ?? 'fact',
          confidence: (n.confidence as import('@/types/mental-model').ConfidenceLevel) ?? 'medium',
          tags:       (n.tags as string[])   ?? [],
          source:     (n.source as string)   ?? '',
          memoryType: (n.memoryType as import('@/types/mental-model').MemoryType) ?? 'semantic',
          scope:      (n.scope as string)    ?? '',
          importance: (n.importance as number) ?? 0.7,
          provenance: (n.provenance as import('@/types/mental-model').Provenance) ?? 'extracted',
          confirmed:  (n.confirmed as boolean) ?? true,
          sensitive:  (n.sensitive as boolean) ?? false,
          groupIds:   (n.groupIds as string[]) ?? [],
        },
        ctx.targetProject,
        ctx.targetConvs,
      )
    }
    setPendingImport(null)
  }

  function handleMoveNodeToGroup(nodeId: string, groupId: string) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const isProject = projects.some(p => p.id === groupId)
    if (isProject) {
      updateNode(nodeId, { projectId: groupId })
    } else {
      updateNode(nodeId, { groupIds: [...new Set([...node.groupIds, groupId])] })
    }
  }

  const hasSelection = selectedIds.size > 0
  const VIEW_ICONS: Record<View, React.ReactNode> = {
    grid:     <LayoutGrid className="h-3.5 w-3.5" />,
    canvas:   <GitBranch className="h-3.5 w-3.5" />,
    graph:    <Network className="h-3.5 w-3.5" />,
    timeline: <GitCommitHorizontal className="h-3.5 w-3.5" />,
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen t-bg t-text overflow-hidden">
        {!onboardingDone && (
          <Onboarding
            onDone={() => setOnboardingDone(true)}
            onImport={() => { setAiTab('extract'); setAiOpen(true) }}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────── */}
        <Sidebar
          nodes={nodes}
          activeCount={activeCount}
          categoryFilter={categoryFilter}
          groupFilter={groupFilter}
          conversationFilter={conversationFilter}
          selectedNodeIds={selectedIds}
          projects={projects}
          conversations={conversations}
          groups={groups}
          onCategoryFilter={f => { setCategoryFilter(f); setSelectedIds(new Set()) }}
          onGroupFilter={id => { setGroupFilter(id); setConversationFilter(null); setSelectedIds(new Set()) }}
          onConversationFilter={id => { setConversationFilter(id); setSelectedIds(new Set()) }}
          onAddGroup={name => addProject(name, `hsl(${Math.floor(Math.random() * 360)} 65% 58%)`)}
          onAddSubGroup={(name, parentId) => addGroup(name, `hsl(${Math.floor(Math.random() * 360)} 65% 58%)`, parentId)}
          onAddConversation={(pid, title) => { addConversation(pid, title); setChatOpen(true) }}
          onUpdateGroup={(id, data) => { updateProject(id, data); updateGroup(id, data) }}
          onUpdateConversation={updateConversation}
          onDeleteGroup={id => { deleteProject(id); deleteGroup(id) }}
          onToggleGroupActive={toggleGroupActive}
          onAddNode={handleSidebarAddNode}
          onFocusNode={handleFocusNode}
          onFocusGroup={handleFocusGroup}
          onEditNode={id => setInspectorId(id)}
          onDeleteNode={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
          onDuplicateNode={handleDuplicateNode}
          onMoveNodeToGroup={handleMoveNodeToGroup}
        />

        {/* ── Main column ───────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Topbar */}
          <header className="flex items-center gap-3 px-5 py-3 border-b t-border shrink-0 t-bg">
            <Brain className="h-5 w-5 t-accent shrink-0" />
            <div className="leading-tight">
              <p className="text-sm font-semibold t-text">Not-a-mental-model</p>
              <p className="text-[10px] t-muted">AI knowledge base</p>
            </div>

            <div className="relative ml-3 max-w-xs flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 t-muted" />
              <Input className="pl-8 h-8 text-xs" placeholder="Search…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>

            {/* View switcher — Xu 2025 adds Timeline */}
            <div className="flex rounded-lg overflow-hidden border t-border">
              {(['grid', 'canvas', 'graph', 'timeline'] as View[]).map((v, i) => (
                <button key={v} onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors capitalize ${
                    view === v ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-bg hover:t-text'
                  } ${i > 0 ? 'border-l t-border' : ''}`}
                >
                  {VIEW_ICONS[v]}{v}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <CopyContextButton
                allNodes={nodes}
                filteredNodes={filtered}
                isVisible={isNodeVisibleToAgent}
                groupLabel={groupFilter ? (groups.find(g => g.id === groupFilter)?.name) : undefined}
                conversationLabel={conversationFilter ? (conversations.find(c => c.id === conversationFilter)?.title) : undefined}
                categoryFilter={categoryFilter}
                hasSearch={!!search.trim()}
              />
              <Button size="sm" variant="ghost" onClick={handleExport} title="Export as JSON">
                <Download className="h-3.5 w-3.5" />Export
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMcpOpen(true)} title="Connect to agents via MCP">
                <Server className="h-3.5 w-3.5" />Connect
              </Button>
              <Button size="sm" variant={chatOpen ? 'secondary' : 'outline'}
                onClick={() => { setChatOpen(v => !v); setSettingsOpen(false) }}>
                <MessageSquare className="h-3.5 w-3.5" />Chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAiTab('extract'); setAiOpen(true) }}>
                <FolderInput className="h-3.5 w-3.5 t-accent" />Import / Extract
              </Button>
              <Button size="sm" variant="outline"
                title="Infer hidden facts probably true but not yet recorded"
                onClick={() => openInfer('explore-infer')}>
                <Telescope className="h-3.5 w-3.5 t-accent" />Explore
              </Button>
              <Button size="sm" onClick={() => {
                const targetProjectId = groupFilter && projects.some(p => p.id === groupFilter) ? groupFilter : undefined
                const extraGroupIds   = groupFilter && !targetProjectId ? [groupFilter] : []
                const n = addNode(
                  { category: 'fact', title: '', content: '', tags: [], confidence: 'medium',
                    source: '', memoryType: 'semantic', scope: '', importance: 0.5,
                    provenance: 'user', confirmed: true, sensitive: false,
                    groupIds: extraGroupIds },
                  targetProjectId,
                  conversationFilter ? [conversationFilter] : undefined,
                )
                setInspectorId(n.id)
              }}>
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
              {nStale > 0 && (
                <button
                  onClick={() => setStaleOpen(v => !v)}
                  title={`${nStale} stale node${nStale > 1 ? 's' : ''} — click to review`}
                  className="relative flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 rounded-lg px-2 h-8 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {nStale}
                </button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => { setSettingsOpen(v => !v); setChatOpen(false) }} title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Views + panels */}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-w-0">

              {view === 'timeline' ? (
                <Timeline nodes={filtered} selectedIds={selectedIds} onEditRequest={id => setInspectorId(id)} onToggleSelect={handleToggleSelect} onUpdate={updateNode} />
              ) : view === 'grid' ? (
                <ScrollArea className="flex-1">
                  <div className="p-5">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 t-muted gap-3">
                        <Brain className="h-10 w-10 opacity-20" />
                        <p className="text-sm">{search ? 'No nodes match your search' : 'No nodes yet'}</p>
                      </div>
                    ) : gridSections ? (
                      <div className="space-y-0">
                        {gridSections.map((section, idx) => (
                          <div key={section.id}>
                            {idx > 0 && <div className="border-t t-border my-6" />}
                            <div className="flex items-center gap-2 mb-3">
                              <FolderOpen className="h-4 w-4 shrink-0" style={{ color: section.color || undefined }} />
                              <span className="text-sm font-semibold t-text">{section.name}</span>
                              <span className="text-[11px] t-muted">({section.items.length})</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {section.items.map(node => (
                                <NodeCard
                                  key={node.id}
                                  node={node}
                                  linkedNodes={getLinkedNodes(node.linkedIds)}
                                  selected={selectedIds.has(node.id)}
                                  onSelect={handleToggleSelect}
                                  onUpdate={updateNode}
                                  onDelete={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
                                  onToggleActive={toggleActive}
                                  onTogglePin={togglePin}
                                  onConfirm={confirmNode}
                                  onEditRequest={id => setInspectorId(id)}
                                  onDistill={handleDistill}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(node => (
                          <NodeCard
                            key={node.id}
                            node={node}
                            linkedNodes={getLinkedNodes(node.linkedIds)}
                            selected={selectedIds.has(node.id)}
                            onSelect={handleToggleSelect}
                            onUpdate={updateNode}
                            onDelete={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
                            onToggleActive={toggleActive}
                            onTogglePin={togglePin}
                            onConfirm={confirmNode}
                            onEditRequest={id => setInspectorId(id)}
                            onDistill={handleDistill}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : view === 'graph' ? (
                <div className="flex-1 min-h-0">
                  <GraphView
                    nodes={nodes}
                    selectedIds={selectedIds}
                    onSelectNode={id => { setSelectedIds(new Set([id])); setInspectorId(id) }}
                    groups={groups}
                    projects={projects}
                    focusNodeId={canvasFocusId}
                    onFocusConsumed={() => setCanvasFocusId(null)}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <Canvas
                    nodes={filtered}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onDeleteNode={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
                    onToggleActive={toggleActive}
                    onTogglePin={togglePin}
                    onToggleSensitive={id => updateNode(id, { sensitive: !nodes.find(n => n.id === id)?.sensitive })}
                    onSetPosition={setPosition}
                    onEditRequest={id => setInspectorId(id)}
                    onUpdate={updateNode}
                    projects={projects}
                    conversations={conversations}
                    groups={groups}
                    groupFilter={groupFilter}
                    conversationFilter={conversationFilter}
                    onUpdateProject={updateProject}
                    onConfirmNode={confirmNode}
                    onDiscardNode={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
                    focusNodeId={canvasFocusId}
                    onFocusConsumed={() => setCanvasFocusId(null)}
                    focusGroupId={canvasFocusGroupId}
                    onFocusGroupConsumed={() => setCanvasFocusGroupId(null)}
                  />
                </div>
              )}

              {/* Bottom bar — stats when idle, selection actions when nodes selected */}
              <div className="border-t t-border px-5 py-2 flex items-center gap-3 t-sidebar shrink-0 min-h-[40px]">
                {hasSelection ? (
                  <>
                    <span className="text-xs t-muted flex-1">
                      {selectedIds.size} selected
                      {selectedIds.size === 1 && (() => {
                        const n = nodes.find(x => x.id === [...selectedIds][0])
                        return n ? <> — <span className="t-text">{n.title}</span></> : null
                      })()}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => { setAiTab('summarize'); setAiOpen(true) }}>
                      <Sparkles className="h-3.5 w-3.5 t-accent" />Summarize
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => openInfer('explore-suggest', selectedNodes)}
                      title="Suggest relevant knowledge based on selected nodes">
                      <Telescope className="h-3.5 w-3.5 t-accent" />Suggest
                    </Button>
                    {selectedIds.size >= 2 && (
                      <Button size="sm" variant="outline" onClick={() => openInfer('from-selection')}
                        title="Ask AI to infer new nodes from the selected nodes">
                        <Bot className="h-3.5 w-3.5 t-accent" />Infer
                      </Button>
                    )}
                    <button
                      className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      onClick={() => {
                        for (const id of selectedIds) deleteNode(id); setSelectedIds(new Set())
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                  </>
                ) : (
                  <StatsBar nodes={nodes} />
                )}
              </div>
            </div>

            {inspectorId && (
              <InspectorPanel
                node={inspectedNode}
                conversations={conversations}
                allNodes={nodes}
                onClose={() => setInspectorId(null)}
                onUpdate={updateNode}
                onDelete={id => { deleteNode(id); setInspectorId(null) }}
                onDeleteOther={deleteNode}
                onToggleActive={toggleActive}
                onTogglePin={togglePin}
                onConfirm={confirmNode}
                onNavigateTo={id => { handleFocusNode(id); setInspectorId(id) }}
              />
            )}

            {chatOpen && (
              <ChatPanel
                nodes={nodes}
                groups={groups}
                onAgentNodes={handleAgentNodes}
                onBumpAccess={bumpAccess}
                onClose={() => setChatOpen(false)}
              />
            )}

            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
            {staleOpen && (
              <div className="w-80 shrink-0 border-l t-border flex flex-col overflow-hidden">
                <StaleReviewPanel
                  nodes={nodes}
                  onToggleActive={toggleActive}
                  onTogglePin={togglePin}
                  onBumpAccess={bumpAccess}
                  onClose={() => setStaleOpen(false)}
                />
              </div>
            )}
          </div>
        </div>

        <Dialog open={mcpOpen} onOpenChange={setMcpOpen}>
          <DialogContent className="max-w-lg">
            <McpExportModal nodes={nodes} onClose={() => setMcpOpen(false)} />
          </DialogContent>
        </Dialog>

<Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-w-xl">
            <ClaudeSync
              onImport={handleImportWithDedup}
              onClose={() => setAiOpen(false)}
              selectedNodes={selectedNodes}
              onSummary={s => { addSummaryNode(s); setSelectedIds(new Set()) }}
              defaultTab={aiTab}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Inference modal — from-selection, explore-infer, explore-suggest */}
      {inferMode && (
        <InferenceModal
          mode={inferMode}
          nodes={inferSourceNodes ?? (inferMode === 'from-selection' ? selectedNodes : nodes.filter(isNodeVisibleToAgent))}
          onAddNodes={handleAgentNodes}
          onClose={() => { setInferMode(null); setInferSourceNodes(null) }}
        />
      )}
    </TooltipProvider>
  )
}
