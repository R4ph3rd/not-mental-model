import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Sparkles, Search, Brain, Trash2, LayoutGrid, GitBranch, GitCommitHorizontal,
  Share2, FolderInput, Settings, Clipboard, ClipboardCheck, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/Sidebar'
import { NodeCard } from '@/components/NodeCard'
import { NodeForm } from '@/components/NodeForm'
import { ClaudeSync } from '@/components/ClaudeSync'
import { StatsBar } from '@/components/StatsBar'
import { Canvas } from '@/components/canvas/Canvas'
import { Timeline } from '@/views/Timeline'
import { InspectorPanel } from '@/components/InspectorPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { ChatPanel } from '@/components/ChatPanel'
import { Onboarding } from '@/components/Onboarding'
import { useMentalModelStore } from '@/store/mental-model-store'
import { callProvider, getDefaultProvider } from '@/lib/providers'
import type { NodeCategory, MentalModelNode } from '@/types/mental-model'

type View = 'grid' | 'canvas' | 'timeline'

export default function App() {
  const {
    nodes, addNode, updateNode, deleteNode,
    toggleActive, togglePin, confirmNode, setPosition,
    importNodes, addSummaryNode,
    projects, addProject,
    conversations, addConversation,
    groups, addGroup, toggleGroupActive,
  } = useMentalModelStore()

  const [view, setView]                             = useState<View>('canvas')
  const [categoryFilter, setCategoryFilter]         = useState<NodeCategory | 'all'>('all')
  const [projectFilter, setProjectFilter]           = useState<string | null>(null)
  const [conversationFilter, setConversationFilter] = useState<string | null>(null)
  const [groupFilter, setGroupFilter]               = useState<string | null>(null)
  const [search, setSearch]                         = useState('')
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen]           = useState(false)
  const [aiOpen, setAiOpen]             = useState(false)
  const [aiTab, setAiTab]               = useState<'extract' | 'summarize'>('extract')
  const [inspectorId, setInspectorId]   = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen]         = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem('mm-onboarding-done'))
  const [copied, setCopied] = useState(false)

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

  function handleCopyContext() {
    const active = nodes.filter(isNodeVisibleToAgent)
    if (active.length === 0) return
    const grouped: Record<string, typeof active> = {}
    for (const n of active) {
      const key = n.category.charAt(0).toUpperCase() + n.category.slice(1) + 's'
      ;(grouped[key] ??= []).push(n)
    }
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const lines = [`## My context — ${date}\n`]
    for (const [grp, items] of Object.entries(grouped)) {
      lines.push(`### ${grp}`)
      for (const n of items) lines.push(`- **${n.title}**: ${n.content}`)
      lines.push('')
    }
    lines.push('---')
    lines.push(
      'This context was exported from my personal knowledge graph and reflects my up-to-date information. ' +
      'If any of the above differs from or adds to what you already know about me, please update your memory accordingly.'
    )
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = useMemo(() => {
    let list = nodes
    if (conversationFilter) list = list.filter(n => n.conversationIds.includes(conversationFilter))
    else if (projectFilter) list = list.filter(n => n.projectId === projectFilter)
    if (groupFilter) list = list.filter(n => n.groupIds.includes(groupFilter))
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
  }, [nodes, categoryFilter, projectFilter, conversationFilter, groupFilter, search])

  const activeCount   = useMemo(() => nodes.filter(isNodeVisibleToAgent).length, [nodes, inactiveGroupIds])
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

  // Chat: agent auto-extracts nodes (Governance paper: provenance = 'agent')
  function handleAgentNodes(raw: Array<{ title: string; content: string; category: NodeCategory; confidence: 'high' | 'medium' | 'low' }>) {
    for (const n of raw) {
      addNode({
        ...n, tags: [], source: 'chat-auto', memoryType: 'semantic',
        scope: '', importance: 0.7,
        provenance: 'agent', confirmed: false, sensitive: false,
      }, projectFilter ?? undefined, conversationFilter ? [conversationFilter] : undefined)
    }
  }

  const hasSelection = selectedIds.size > 0
  const VIEW_ICONS: Record<View, React.ReactNode> = {
    grid: <LayoutGrid className="h-3.5 w-3.5" />,
    canvas: <GitBranch className="h-3.5 w-3.5" />,
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
          projectFilter={projectFilter}
          conversationFilter={conversationFilter}
          groupFilter={groupFilter}
          projects={projects}
          conversations={conversations}
          groups={groups}
          onCategoryFilter={f => { setCategoryFilter(f); setSelectedIds(new Set()) }}
          onProjectFilter={id => { setProjectFilter(id); setConversationFilter(null); setSelectedIds(new Set()) }}
          onConversationFilter={id => { setConversationFilter(id); setSelectedIds(new Set()) }}
          onGroupFilter={id => { setGroupFilter(id); setSelectedIds(new Set()) }}
          onAddProject={name => addProject(name, `hsl(${Math.floor(Math.random() * 360)} 65% 58%)`)}
          onAddConversation={(pid, title) => addConversation(pid, title)}
          onAddGroup={name => addGroup(name, `hsl(${Math.floor(Math.random() * 360)} 65% 58%)`)}
          onToggleGroupActive={toggleGroupActive}
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
              {(['grid', 'canvas', 'timeline'] as View[]).map((v, i) => (
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
              <Button size="sm" variant="ghost" onClick={handleCopyContext}
                title="Copy active (non-sensitive) nodes as context — paste into any AI chat">
                {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-green-400" /> : <Clipboard className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleExport} title="Export as JSON">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant={chatOpen ? 'secondary' : 'outline'}
                onClick={() => { setChatOpen(v => !v); setSettingsOpen(false) }}>
                <MessageSquare className="h-3.5 w-3.5" />Chat
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAiTab('extract'); setAiOpen(true) }}>
                <FolderInput className="h-3.5 w-3.5 t-accent" />Import / Extract
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
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
                <Timeline nodes={filtered} onEditRequest={id => setInspectorId(id)} />
              ) : view === 'grid' ? (
                <ScrollArea className="flex-1">
                  <div className="p-5">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 t-muted gap-3">
                        <Brain className="h-10 w-10 opacity-20" />
                        <p className="text-sm">{search ? 'No nodes match your search' : 'No nodes yet'}</p>
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
              ) : (
                <div className="flex-1 min-h-0">
                  <Canvas
                    nodes={filtered}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onDeleteNode={id => { deleteNode(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }}
                    onToggleActive={toggleActive}
                    onTogglePin={togglePin}
                    onSetPosition={setPosition}
                    onEditRequest={id => setInspectorId(id)}
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
                    <Button size="sm" variant="destructive" onClick={() => {
                      for (const id of selectedIds) deleteNode(id); setSelectedIds(new Set())
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </Button>
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
                onClose={() => setInspectorId(null)}
                onUpdate={updateNode}
                onDelete={id => { deleteNode(id); setInspectorId(null) }}
              />
            )}

            {chatOpen && (
              <ChatPanel
                nodes={nodes}
                groups={groups}
                onAgentNodes={handleAgentNodes}
                onClose={() => setChatOpen(false)}
              />
            )}

            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <p className="text-sm font-semibold t-text mb-1">Add node</p>
            <NodeForm
              onSubmit={data => {
                addNode(data, projectFilter ?? undefined, conversationFilter ? [conversationFilter] : undefined)
                setAddOpen(false)
              }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-w-xl">
            <ClaudeSync
              onImport={importNodes}
              onClose={() => setAiOpen(false)}
              selectedNodes={selectedNodes}
              onSummary={s => { addSummaryNode(s); setSelectedIds(new Set()) }}
              defaultTab={aiTab}
            />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
