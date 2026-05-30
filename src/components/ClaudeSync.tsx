import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Layers, Brain, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PROVIDER_CONFIGS, callProvider, getDefaultProvider } from '@/lib/providers'
import { cn } from '@/lib/utils'
import type { MentalModelNode } from '@/types/mental-model'

interface Props {
  onImport: (nodes: MentalModelNode[]) => void
  onClose: () => void
  selectedNodes?: MentalModelNode[]
  onSummary?: (s: { title: string; content: string; tags: string[]; scope: string }) => void
  defaultTab?: 'extract' | 'memory' | 'summarize'
}

const EXTRACT_SYSTEM = `You extract structured knowledge from conversation text to build a mental model of the user.

Extract facts, preferences, skills, goals, projects, and conversation topics. Return ONLY a valid JSON array with no markdown fences:
[{
  "id": "node-<random-8chars>",
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label (max 60 chars)",
  "content": "detailed description (1-3 sentences)",
  "tags": ["tag1", "tag2"],
  "confidence": "high"|"medium"|"low",
  "memoryType": "episodic"|"semantic",
  "scope": "Work"|"Personal"|"Skills"|"Goals"|"Research"|"Side projects"|"",
  "source": "extracted",
  "active": true,
  "pinned": false,
  "importance": 0.8,
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "linkedIds": []
}]

Guidelines:
- episodic = tied to a specific event/conversation; semantic = general lasting knowledge
- importance: 1.0 for critical facts, 0.5 for minor details
- Be concise. Do not invent information not present in the text.`

const MEMORY_IMPORT_SYSTEM = `You convert a raw list of AI memory bullet points into structured knowledge nodes.

The input is a list of memories as shown in an AI assistant's settings page (e.g. "• User prefers dark themes").
Return ONLY a valid JSON array with no markdown fences:
[{
  "id": "node-<random-8chars>",
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label (max 60 chars)",
  "content": "expanded description (1-2 sentences)",
  "tags": ["tag1"],
  "confidence": "high"|"medium"|"low",
  "memoryType": "episodic"|"semantic",
  "scope": "Work"|"Personal"|"Skills"|"Goals"|"",
  "source": "claude-memory",
  "active": true,
  "pinned": false,
  "importance": 0.85,
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "linkedIds": []
}]

Guidelines:
- Most memories are semantic (general facts about the person)
- Group related bullet points into one node when they clearly belong together
- Infer the best category: preferences → "preference", skills → "skill", ongoing work → "project", etc.`

const SUMMARIZE_SYSTEM = `You synthesize multiple memory nodes into a single concise semantic memory. Return ONLY a JSON object with no markdown fences:
{
  "title": "concise label",
  "content": "synthesized insight combining all nodes",
  "tags": ["relevant", "tags"],
  "scope": "scope name or empty string"
}`

// ── Provider picker ──────────────────────────────────────────────────────────

function ProviderPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest t-muted">AI provider</p>
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_CONFIGS.map(p => {
          const hasKey = p.type === 'ollama'
            ? true
            : !!localStorage.getItem(p.storageKey)
          const active = value === p.id
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
                active
                  ? 't-accent-border t-accent-subtle t-accent font-medium'
                  : hasKey
                    ? 't-border t-card t-text hover:t-accent hover:t-accent-border'
                    : 't-border t-card t-muted opacity-50',
              )}
            >
              {p.label}
              {p.free && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-medium">
                  free
                </span>
              )}
              {!hasKey && p.type !== 'ollama' && (
                <span className="text-[9px] t-muted">no key</span>
              )}
            </button>
          )
        })}
      </div>
      {!PROVIDER_CONFIGS.some(p => p.type !== 'ollama' && localStorage.getItem(p.storageKey)) && (
        <p className="text-[10px] t-muted">
          No keys set. Add one in Settings, or use Ollama locally.
          {' '}
          <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer"
            className="t-accent underline inline-flex items-center gap-0.5">
            Get a free Groq key <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
      )}
    </div>
  )
}

// ── Extract tab ──────────────────────────────────────────────────────────────

function ExtractTab({ provider, onImport, onClose }: { provider: string; onImport: (n: MentalModelNode[]) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MentalModelNode[] | null>(null)

  async function handleExtract() {
    setLoading(true); setError(null); setPreview(null)
    try {
      const raw = await callProvider(provider, EXTRACT_SYSTEM, `Extract memory nodes from this text:\n\n${text}`)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array in response')
      setPreview(JSON.parse(match[0]) as MentalModelNode[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs t-text font-medium">Conversation or notes</p>
        <Textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste a conversation, notes, or any text about the user…" rows={6} />
      </div>
      <ErrMsg msg={error} />
      <NodePreview nodes={preview} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        {preview
          ? <Button size="sm" onClick={() => { onImport(preview); onClose() }}>Import {preview.length} nodes</Button>
          : <Button size="sm" onClick={handleExtract} disabled={loading || !text.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Extract
            </Button>
        }
      </div>
    </div>
  )
}

// ── Memory import tab ────────────────────────────────────────────────────────

function MemoryTab({ provider, onImport, onClose }: { provider: string; onImport: (n: MentalModelNode[]) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MentalModelNode[] | null>(null)

  async function handleImport() {
    setLoading(true); setError(null); setPreview(null)
    try {
      const raw = await callProvider(provider, MEMORY_IMPORT_SYSTEM, `Convert these memories into structured nodes:\n\n${text}`)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array in response')
      setPreview(JSON.parse(match[0]) as MentalModelNode[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Instructions */}
      <div className="rounded-lg t-card border t-border p-3 space-y-2">
        <p className="text-xs font-medium t-text flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 t-accent" />
          How to export your claude.ai memories
        </p>
        <ol className="text-[11px] t-muted space-y-1 list-decimal list-inside">
          <li>Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="t-accent underline inline-flex items-center gap-0.5">claude.ai <ExternalLink className="h-2.5 w-2.5" /></a></li>
          <li>Click your avatar → <strong className="t-text">Settings</strong> → <strong className="t-text">Memory</strong></li>
          <li>Select all memories and copy the text</li>
          <li>Paste below</li>
        </ol>
        <p className="text-[10px] t-muted border-t t-border pt-2">
          Works with any AI's memory export — ChatGPT, Gemini, etc.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs t-text font-medium">Memory list</p>
        <Textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="• User prefers dark themes&#10;• Working on a React project&#10;• Lives in Paris&#10;..."
          rows={7} />
      </div>
      <ErrMsg msg={error} />
      <NodePreview nodes={preview} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        {preview
          ? <Button size="sm" onClick={() => { onImport(preview); onClose() }}>Import {preview.length} nodes</Button>
          : <Button size="sm" onClick={handleImport} disabled={loading || !text.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              Parse memories
            </Button>
        }
      </div>
    </div>
  )
}

// ── Summarize tab ────────────────────────────────────────────────────────────

function SummarizeTab({ provider, nodes, onSummary, onClose }: {
  provider: string
  nodes: MentalModelNode[]
  onSummary: (s: { title: string; content: string; tags: string[]; scope: string }) => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; content: string; tags: string[]; scope: string } | null>(null)

  async function handleSummarize() {
    setLoading(true); setError(null); setPreview(null)
    const nodeText = nodes.map(n => `[${n.category}] ${n.title}: ${n.content}`).join('\n\n')
    try {
      const raw = await callProvider(provider, SUMMARIZE_SYSTEM, `Summarize these ${nodes.length} memory nodes:\n\n${nodeText}`)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object in response')
      setPreview(JSON.parse(match[0]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg t-card border t-border p-3 space-y-1">
        <p className="text-xs t-muted font-medium">Summarizing {nodes.length} nodes</p>
        {nodes.map(n => (
          <p key={n.id} className="text-xs t-muted">· <span className="t-text">{n.title}</span></p>
        ))}
      </div>
      <ErrMsg msg={error} />
      {preview && (
        <div className="rounded-lg t-accent-subtle border t-accent-border p-3 space-y-1.5">
          <p className="text-xs font-semibold t-text">{preview.title}</p>
          <p className="text-xs t-muted">{preview.content}</p>
          {preview.tags.length > 0 && (
            <p className="text-[10px] t-muted">{preview.tags.map(t => `#${t}`).join(' ')}</p>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        {preview
          ? <Button size="sm" onClick={() => { onSummary(preview); onClose() }}>Add summary node</Button>
          : <Button size="sm" onClick={handleSummarize} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              Summarize
            </Button>
        }
      </div>
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────

function ErrMsg({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-500/30 p-3 text-xs text-red-300">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{msg}
    </div>
  )
}

function NodePreview({ nodes }: { nodes: MentalModelNode[] | null }) {
  if (!nodes) return null
  return (
    <div className="rounded-lg bg-green-900/10 border border-green-500/20 p-3 space-y-1">
      <p className="text-xs text-green-400 font-medium">{nodes.length} nodes ready to import</p>
      {nodes.map(n => (
        <p key={n.id} className="text-xs t-muted">· <span className="t-text">{n.title}</span> <span className="opacity-50">({n.category})</span></p>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ClaudeSync({ onImport, onClose, selectedNodes, onSummary, defaultTab = 'extract' }: Props) {
  const [provider, setProvider] = useState(getDefaultProvider)

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 t-text">
          <Sparkles className="h-4 w-4 t-accent" />
          AI Import
        </DialogTitle>
        <DialogDescription className="t-muted">
          Extract knowledge from conversations, import your AI memory, or distill selected nodes.
        </DialogDescription>
      </DialogHeader>

      <ProviderPicker value={provider} onChange={setProvider} />

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full">
          <TabsTrigger value="extract" className="flex-1">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Extract
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex-1">
            <Brain className="h-3.5 w-3.5 mr-1.5" />Import Memory
          </TabsTrigger>
          <TabsTrigger value="summarize" className="flex-1" disabled={!selectedNodes?.length}>
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Summarize{selectedNodes?.length ? ` (${selectedNodes.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="mt-3">
          <ExtractTab provider={provider} onImport={onImport} onClose={onClose} />
        </TabsContent>
        <TabsContent value="memory" className="mt-3">
          <MemoryTab provider={provider} onImport={onImport} onClose={onClose} />
        </TabsContent>
        <TabsContent value="summarize" className="mt-3">
          {selectedNodes && onSummary && (
            <SummarizeTab provider={provider} nodes={selectedNodes} onSummary={onSummary} onClose={onClose} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
