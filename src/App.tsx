import { useState, useMemo, useCallback } from 'react'
import { Plus, Sparkles, Search, Brain, Trash2, LayoutGrid, GitBranch, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/Sidebar'
import { NodeCard } from '@/components/NodeCard'
import { NodeForm } from '@/components/NodeForm'
import { AISync } from '@/components/AISync'
import { StatsBar } from '@/components/StatsBar'
import { Canvas } from '@/components/canvas/Canvas'
import { useMentalModelStore } from '@/store/mental-model-store'
import type { NodeCategory } from '@/types/mental-model'

type View = 'grid' | 'canvas'

export default function App() {
  const {
    nodes, addNode, updateNode, deleteNode,
    toggleActive, togglePin, setPosition,
    importNodes, addSummaryNode,
  } = useMentalModelStore()

  const [view, setView] = useState<View>('canvas')
  const [categoryFilter, setCategoryFilter] = useState<NodeCategory | 'all'>('all')
  const [scopeFilter, setScopeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudeDefaultTab, setClaudeDefaultTab] = useState<'extract' | 'summarize'>('extract')

  // Derived scopes — CHI 2025: project-based hierarchy
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

  const activeCount = useMemo(() => nodes.filter(n => n.active).length, [nodes])
  const selectedNodes = useMemo(() => nodes.filter(n => selectedIds.has(n.id)), [nodes, selectedIds])

  const handleToggleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(id)) next.delete(id); else next.add(id)
      } else {
        if (next.has(id) && next.size === 1) next.clear(); else { next.clear(); next.add(id) }
      }
      return next
    })
  }, [])

  function getLinkedNodes(ids: string[]) {
    return nodes.filter(n => ids.includes(n.id))
  }

  function handleExport() {
    const toExport = selectedIds.size > 0 ? selectedNodes : nodes
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mental-model-${Date.now()}.json`
    a.click()
  }

  function openSummarize() {
    setClaudeDefaultTab('summarize')
    setClaudeOpen(true)
  }

  function openExtract() {
    setClaudeDefaultTab('extract')
    setClaudeOpen(true)
  }

  const hasSelection = selectedIds.size > 0

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen bg-zinc-950 text-white overflow-hidden">

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

        <div className="flex flex-col flex-1 min-w-0">

          {/* Topbar */}
          <header className="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0">
            <Brain className="h-5 w-5 text-purple-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">Mental Model</span>
              <span className="text-[10px] text-white/25">AI knowledge base</span>
            </div>

            <div className="flex-1 max-w-xs ml-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <Input className="pl-8 h-8 text-xs" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* View switcher */}
            <div className="flex rounded-md overflow-hidden border border-white/10">
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${view === 'grid' ? 'bg-purple-600/30 text-purple-300' : 'text-white/40 hover:bg-white/5'}`}
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />Grid
              </button>
              <button
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors border-l border-white/10 ${view === 'canvas' ? 'bg-purple-600/30 text-purple-300' : 'text-white/40 hover:bg-white/5'}`}
                onClick={() => setView('canvas')}
              >
                <GitBranch className="h-3.5 w-3.5" />Canvas
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {hasSelection && (
                <Button size="sm" variant="outline" onClick={openSummarize}>
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  Summarize ({selectedIds.size})
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleExport} title="Export nodes as JSON">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={openExtract}>
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Extract
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
            </div>
          </header>

          {/* Stats */}
          <div className="px-5 py-2 border-b border-white/5 shrink-0">
            <StatsBar nodes={nodes} selectedCount={selectedIds.size} />
          </div>

          {/* Main view */}
          {view === 'grid' ? (
            <ScrollArea className="flex-1">
              <div className="p-5">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-white/20 gap-3">
                    <Brain className="h-10 w-10 opacity-30" />
                    <p className="text-sm">{search ? 'No nodes match' : 'No nodes yet'}</p>
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
                onUpdateNode={updateNode}
                onDeleteNode={id => { deleteNode(id); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n }) }}
                onToggleActive={toggleActive}
                onTogglePin={togglePin}
                onSetPosition={setPosition}
              />
            </div>
          )}

          {/* Selection action bar */}
          {hasSelection && (
            <div className="border-t border-white/8 px-5 py-2.5 flex items-center gap-3 bg-zinc-900/80 shrink-0">
              <span className="text-xs text-white/40 flex-1">
                {selectedIds.size} node{selectedIds.size > 1 ? 's' : ''} selected
                {selectedIds.size === 1 && (() => {
                  const n = nodes.find(x => x.id === [...selectedIds][0])
                  return n ? <> — <span className="text-white/70">{n.title}</span></> : null
                })()}
              </span>
              <Button size="sm" variant="outline" onClick={openSummarize}>
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />Summarize
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

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <NodeForm
              onSubmit={data => { addNode(data); setAddOpen(false) }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={claudeOpen} onOpenChange={setClaudeOpen}>
          <DialogContent className="max-w-xl">
            <AISync
              onImport={importNodes}
              onClose={() => setClaudeOpen(false)}
              selectedNodes={selectedNodes}
              onSummary={s => { addSummaryNode(s); setSelectedIds(new Set()) }}
              defaultTab={claudeDefaultTab}
            />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
