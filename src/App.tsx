import { useState, useMemo } from 'react'
import { Plus, Sparkles, Search, Brain, Trash2 } from 'lucide-react'
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
import { useMentalModelStore } from '@/store/mental-model-store'
import type { NodeCategory } from '@/types/mental-model'

export default function App() {
  const { nodes, addNode, updateNode, deleteNode, importFromClaude } = useMentalModelStore()
  const [filter, setFilter] = useState<NodeCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = filter === 'all' ? nodes : nodes.filter(n => n.category === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [nodes, filter, search])

  const counts = useMemo(() => {
    const c = {} as Record<NodeCategory, number>
    for (const n of nodes) c[n.category] = (c[n.category] ?? 0) + 1
    return c
  }, [nodes])

  function getLinkedNodes(ids: string[]) {
    return nodes.filter(n => ids.includes(n.id))
  }

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen bg-zinc-950 text-white overflow-hidden">

        {/* Sidebar */}
        <Sidebar counts={counts} total={nodes.length} activeFilter={filter} onFilter={setFilter} />

        {/* Main */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Topbar */}
          <header className="flex items-center gap-3 px-6 py-4 border-b border-white/8 shrink-0">
            <Brain className="h-5 w-5 text-purple-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">Mental Model</span>
              <span className="text-[10px] text-white/30">AI's understanding of you</span>
            </div>

            <div className="flex-1 max-w-sm ml-4 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search nodes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setClaudeOpen(true)}>
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Extract with Claude
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add node
              </Button>
            </div>
          </header>

          {/* Stats */}
          <div className="px-6 py-2.5 border-b border-white/5 shrink-0">
            <StatsBar nodes={nodes} />
          </div>

          {/* Node grid */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/25 gap-3">
                  <Brain className="h-10 w-10 opacity-30" />
                  <p className="text-sm">{search ? 'No nodes match your search' : 'No nodes yet — add one or extract from a conversation'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      linkedNodes={getLinkedNodes(node.linkedIds)}
                      onUpdate={updateNode}
                      onDelete={deleteNode}
                      onSelect={handleSelect}
                      selected={selectedId === node.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Selection action bar */}
          {selectedId && (() => {
            const node = nodes.find(n => n.id === selectedId)
            if (!node) return null
            return (
              <div className="border-t border-white/8 px-6 py-3 flex items-center gap-3 bg-zinc-900/60 backdrop-blur-sm shrink-0">
                <span className="text-xs text-white/50 flex-1">
                  Selected: <span className="text-white/80">{node.title}</span>
                </span>
                <Button size="sm" variant="destructive" onClick={() => { deleteNode(selectedId); setSelectedId(null) }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                  Deselect
                </Button>
              </div>
            )
          })()}
        </div>

        {/* Add node dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <NodeForm
              onSubmit={data => { addNode(data); setAddOpen(false) }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Claude sync dialog */}
        <Dialog open={claudeOpen} onOpenChange={setClaudeOpen}>
          <DialogContent className="max-w-xl">
            <ClaudeSync onImport={importFromClaude} onClose={() => setClaudeOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
