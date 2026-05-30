import { useState, useMemo, useCallback } from 'react'
import { Plus, Sparkles, Search, Brain, Trash2, LayoutGrid, GitBranch, Download, Settings, Clipboard, ClipboardCheck } from 'lucide-react'
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
import { InspectorPanel } from '@/components/InspectorPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Onboarding } from '@/components/Onboarding'
import { useMentalModelStore } from '@/store/mental-model-store'
import type { NodeCategory } from '@/types/mental-model'

type View = 'grid' | 'canvas'

export default function App() {
  const {
    nodes, addNode, updateNode, deleteNode,
    toggleActive, togglePin, setPosition,
    importNodes, addSummaryNode,
  } = useMentalModelStore()

  const [view, setView]                     = useState<View>('canvas')
  const [categoryFilter, setCategoryFilter] = useState<NodeCategory | 'all'>('all')
  const [scopeFilter, setScopeFilter]       = useState('')
  const [search, setSearch]                 = useState('')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen]               = useState(false)
  const [aiOpen, setAiOpen]                 = useState(false)
  const [aiTab, setAiTab]                   = useState<'extract' | 'summarize'>('extract')
  const [inspectorId, setInspectorId]       = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('mm-onboarding-done')
  )
  const [copied, setCopied] = useState(false)

  function handleCopyContext() {
    const active = nodes.filter(n => n.active)
    if (active.length === 0) return
    const groups: Record<string, typeof active> = {}
    for (const n of active) {
      const key = n.category.charAt(0).toUpperCase() + n.category.slice(1) + 's'
      ;(groups[key] ??= []).push(n)
    }
    const lines = ['## My context\n']
    for (const [group, items] of Object.entries(groups)) {
      lines.push(`### ${group}`)
      for (const n of items) lines.push(`- **${n.title}**: ${n.content}`)
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const scopes = useMemo(() => {
    const s = new Set(nodes.map(n => n.scope).filter(Boolean))
    return [...s].sort()
  }, [nodes])

  const filtered = useMemo(() => {
    let list = nodes
    if (categoryFilter !== 'all') list = list.filter(n => n.category === categoryFilter)
    if (scopeFilter) list = list.filter(n => n.scope === scopeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q)) ||
        n.scope.toLowerCase().includes(q)
      )
    }
    return list
  }, [nodes, categoryFilter, scopeFilter, search])

  const counts = useMemo(() => {
    const c = {} as Record<NodeCategory, number>
    for (const n of nodes) c[n.category] = (c[n.category] ?? 0) + 1
    return c
  }, [nodes])

  const activeCount   = useMemo(() => nodes.filter(n => n.active).length, [nodes])
  const selectedNodes = useMemo(() => nodes.filter(n => selectedIds.has(n.id)), [nodes, selectedIds])
  const inspectedNode = useMemo(() => nodes.find(n => n.id === inspectorId) ?? null, [nodes, inspectorId])

  const handleToggleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) next.delete(id); else next.add(id)
      } else {
        if (next.has(id) && next.size === 1) next.clear()
        else { next.clear(); next.add(id) }
      }
      return next
    })
  }, [])

  function handleEditRequest(id: string) {
    setInspectorId(id)
  }

  function handleExport() {
    const toExport = selectedIds.size > 0 ? selectedNodes : nodes
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mental-model-${Date.now()}.json`
    a.click()
  }

  function getLinkedNodes(ids: string[]) {
    return nodes.filter(n => ids.includes(n.id))
  }

  const hasSelection = selectedIds.size > 0

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen t-bg t-text overflow-hidden">

        {/* Onboarding */}
        {!onboardingDone && <Onboarding onDone={() => setOnboardingDone(true)} />}

        {/* ── Sidebar ─────────────────────────────────── */}
        <Sidebar
          counts={counts}
          total={nodes.length}
          activeCount={activeCount}
          categoryFilter={categoryFilter}
          scopeFilter={scopeFilter}
          scopes={scopes}
          onCategoryFilter={f => { setCategoryFilter(f); setSelectedIds(new Set()) }}
          onScopeFilter={s => { setScopeFilter(s); setSelectedIds(new Set()) }}
        />

        {/* ── Main column ─────────────────────────────── */}
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

            {/* View switcher */}
            <div className="flex rounded-lg overflow-hidden border t-border">
              {(['grid', 'canvas'] as View[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors capitalize ${
                    view === v
                      ? 't-accent-subtle t-accent font-medium'
                      : 't-muted hover:t-bg hover:t-text'
                  } ${v === 'canvas' ? 'border-l t-border' : ''}`}
                >
                  {v === 'grid' ? <LayoutGrid className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}
                  {v}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {hasSelection && (
                <Button size="sm" variant="outline" onClick={() => { setAiTab('summarize'); setAiOpen(true) }}>
                  <Sparkles className="h-3.5 w-3.5 t-accent" />
                  Summarize ({selectedIds.size})
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleCopyContext}
                title="Copy active nodes as context block — paste into any AI conversation">
                {copied
                  ? <ClipboardCheck className="h-3.5 w-3.5 text-green-400" />
                  : <Clipboard className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleExport} title="Export as JSON">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAiTab('extract'); setAiOpen(true) }}>
                <Sparkles className="h-3.5 w-3.5 t-accent" />
                Import / Extract
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8"
                onClick={() => setSettingsOpen(v => !v)} title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Stats */}
          <div className="px-5 py-2 border-b t-border shrink-0">
            <StatsBar nodes={nodes} selectedCount={selectedIds.size} />
          </div>

          {/* Canvas / Grid + Inspector side-by-side */}
          <div className="flex flex-1 min-h-0">

            {/* Main view */}
            <div className="flex-1 flex flex-col min-w-0">
              {view === 'grid' ? (
                <ScrollArea className="flex-1">
                  <div className="p-5">
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 t-muted gap-3">
                        <Brain className="h-10 w-10 opacity-20" />
                        <p className="text-sm">{search ? 'No nodes match your search' : 'No nodes yet — add one or extract from a conversation'}</p>
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
                            onDelete={id => { deleteNode(id); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n }) }}
                            onToggleActive={toggleActive}
                            onTogglePin={togglePin}
                            onEditRequest={handleEditRequest}
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
                    onDeleteNode={id => { deleteNode(id); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n }) }}
                    onToggleActive={toggleActive}
                    onTogglePin={togglePin}
                    onSetPosition={setPosition}
                    onEditRequest={handleEditRequest}
                  />
                </div>
              )}

              {/* Selection action bar */}
              {hasSelection && (
                <div className="border-t t-border px-5 py-2.5 flex items-center gap-3 t-sidebar shrink-0">
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
                    for (const id of selectedIds) deleteNode(id)
                    setSelectedIds(new Set())
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                </div>
              )}
            </div>

            {/* Inspector panel */}
            {inspectorId && (
              <InspectorPanel
                node={inspectedNode}
                onClose={() => setInspectorId(null)}
                onUpdate={updateNode}
                onDelete={id => { deleteNode(id); setInspectorId(null) }}
              />
            )}

            {/* Settings panel */}
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>

        {/* Add node dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <p className="text-sm font-semibold t-text mb-1">Add node</p>
            <NodeForm
              onSubmit={data => { addNode(data); setAddOpen(false) }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* AI dialog */}
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
