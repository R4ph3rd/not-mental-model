import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Layers, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { MentalModelNode } from '@/types/mental-model'
import { PROVIDERS, STORAGE_KEYS, callProvider, getProvider } from '@/lib/providers'
import type { ProviderId } from '@/lib/providers'

interface Props {
  onImport: (nodes: MentalModelNode[]) => void
  onClose: () => void
  selectedNodes?: MentalModelNode[]
  onSummary?: (s: { title: string; content: string; tags: string[]; scope: string }) => void
  defaultTab?: 'extract' | 'summarize'
}

const EXTRACT_SYSTEM = `You extract structured knowledge from text to build a mental model of the user.

Extract facts, preferences, skills, goals, projects, and conversation topics. Return ONLY a valid JSON array:
[{
  "id": "node-<random-8chars>",
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label",
  "content": "detailed description",
  "tags": ["tag1"],
  "confidence": "high"|"medium"|"low",
  "memoryType": "episodic"|"semantic",
  "scope": "Work"|"Personal"|"Skills"|...,
  "source": "extracted",
  "active": true,
  "pinned": false,
  "importance": 0.8,
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "linkedIds": []
}]`

const SUMMARIZE_SYSTEM = `You synthesize multiple memory nodes into a single concise semantic memory. Return ONLY a JSON object:
{
  "title": "concise label for the summary",
  "content": "synthesized insight combining all nodes",
  "tags": ["relevant", "tags"],
  "scope": "scope name or empty string"
}`

// ─── Provider picker ──────────────────────────────────────────────────────────

interface ProviderPickerProps {
  providerId: ProviderId
  model: string
  apiKey: string
  onProvider: (id: ProviderId) => void
  onModel: (m: string) => void
  onKey: (k: string) => void
}

function ProviderPicker({ providerId, model, apiKey, onProvider, onModel, onKey }: ProviderPickerProps) {
  const provider = getProvider(providerId)

  return (
    <div className="space-y-3 rounded-md border border-white/8 bg-white/2 p-3">
      <div className="flex items-center gap-2">
        {/* Provider selector */}
        <div className="flex gap-1 flex-wrap">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => onProvider(p.id)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                p.id === providerId
                  ? 'border-purple-500/60 bg-purple-600/20 text-purple-300'
                  : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white/70'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {/* Model */}
        <div className="w-44 shrink-0">
          <Select value={model} onValueChange={onModel}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
              <ChevronDown className="h-3 w-3 opacity-50 ml-auto" />
            </SelectTrigger>
            <SelectContent>
              {provider.models.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API key / base URL */}
        <Input
          type={provider.requiresKey ? 'password' : 'text'}
          className="h-8 text-xs flex-1"
          value={apiKey}
          onChange={e => onKey(e.target.value)}
          placeholder={provider.keyPlaceholder}
        />
      </div>
      <p className="text-[10px] text-white/20">
        {provider.id === 'ollama'
          ? 'Enter the base URL of your Ollama instance (default: http://localhost:11434).'
          : `${provider.keyLabel} — stored in localStorage only, sent only to ${provider.name}.`}
      </p>
    </div>
  )
}

// ─── Shared hook for provider state ──────────────────────────────────────────

function useProviderState() {
  const [providerId, setProviderId] = useState<ProviderId>(
    () => (localStorage.getItem(STORAGE_KEYS.provider) as ProviderId) ?? 'anthropic'
  )
  const provider = getProvider(providerId)

  const [model, setModel] = useState(
    () => localStorage.getItem(STORAGE_KEYS.model(providerId)) ?? provider.models[0].id
  )
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(STORAGE_KEYS.key(providerId)) ?? ''
  )

  function handleProvider(id: ProviderId) {
    setProviderId(id)
    localStorage.setItem(STORAGE_KEYS.provider, id)
    const p = getProvider(id)
    const savedModel = localStorage.getItem(STORAGE_KEYS.model(id)) ?? p.models[0].id
    const savedKey = localStorage.getItem(STORAGE_KEYS.key(id)) ?? ''
    setModel(savedModel)
    setApiKey(savedKey)
  }

  function handleModel(m: string) {
    setModel(m)
    localStorage.setItem(STORAGE_KEYS.model(providerId), m)
  }

  function handleKey(k: string) {
    setApiKey(k)
    localStorage.setItem(STORAGE_KEYS.key(providerId), k)
  }

  const canCall = providerId === 'ollama' || !!apiKey.trim()

  return { providerId, provider, model, apiKey, canCall, handleProvider, handleModel, handleKey }
}

// ─── Extract tab ──────────────────────────────────────────────────────────────

interface ExtractTabProps {
  onImport: (nodes: MentalModelNode[]) => void
  onClose: () => void
  providerState: ReturnType<typeof useProviderState>
}

function ExtractTab({ onImport, onClose, providerState }: ExtractTabProps) {
  const { providerId, model, apiKey, canCall, handleProvider, handleModel, handleKey } = providerState
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MentalModelNode[] | null>(null)

  async function handleExtract() {
    setLoading(true); setError(null); setPreview(null)
    try {
      const raw = await callProvider(providerId, apiKey.trim(), model, EXTRACT_SYSTEM, `Extract memory nodes:\n\n${text}`)
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
      <ProviderPicker
        providerId={providerId} model={model} apiKey={apiKey}
        onProvider={handleProvider} onModel={handleModel} onKey={handleKey}
      />

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Conversation / Notes</label>
        <Textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste a conversation or notes about the user…" rows={5} />
      </div>

      {error && <ErrorBox message={error} />}
      {preview && (
        <div className="rounded-md bg-green-900/10 border border-green-500/20 p-3 space-y-1">
          <p className="text-xs text-green-400 font-medium">{preview.length} nodes extracted</p>
          {preview.map(n => (
            <p key={n.id} className="text-xs text-white/55">· <span className="text-white/80">{n.title}</span> ({n.category})</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {preview
          ? <Button onClick={() => { onImport(preview); onClose() }}>Import {preview.length} nodes</Button>
          : <Button onClick={handleExtract} disabled={loading || !canCall || !text.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}Extract
            </Button>}
      </div>
    </div>
  )
}

// ─── Summarize tab ────────────────────────────────────────────────────────────

interface SummarizeTabProps {
  nodes: MentalModelNode[]
  onSummary: (s: { title: string; content: string; tags: string[]; scope: string }) => void
  onClose: () => void
  providerState: ReturnType<typeof useProviderState>
}

function SummarizeTab({ nodes, onSummary, onClose, providerState }: SummarizeTabProps) {
  const { providerId, model, apiKey, canCall, handleProvider, handleModel, handleKey } = providerState
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; content: string; tags: string[]; scope: string } | null>(null)

  async function handleSummarize() {
    setLoading(true); setError(null); setPreview(null)
    const nodeText = nodes.map(n => `[${n.category}] ${n.title}: ${n.content}`).join('\n\n')
    try {
      const raw = await callProvider(providerId, apiKey.trim(), model, SUMMARIZE_SYSTEM,
        `Summarize these ${nodes.length} memory nodes:\n\n${nodeText}`)
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
      <div className="rounded-md bg-white/3 border border-white/8 p-3 space-y-1">
        <p className="text-xs text-white/50 font-medium">Summarizing {nodes.length} nodes</p>
        {nodes.map(n => <p key={n.id} className="text-xs text-white/40">· {n.title}</p>)}
      </div>

      <ProviderPicker
        providerId={providerId} model={model} apiKey={apiKey}
        onProvider={handleProvider} onModel={handleModel} onKey={handleKey}
      />

      {error && <ErrorBox message={error} />}
      {preview && (
        <div className="rounded-md bg-purple-900/10 border border-purple-500/20 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-white">{preview.title}</p>
          <p className="text-xs text-white/55">{preview.content}</p>
          {preview.tags.length > 0 && (
            <p className="text-[10px] text-white/30">{preview.tags.map(t => `#${t}`).join(' ')}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {preview
          ? <Button onClick={() => { onSummary(preview); onClose() }}>Add summary node</Button>
          : <Button onClick={handleSummarize} disabled={loading || !canCall}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}Summarize
            </Button>}
      </div>
    </div>
  )
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-red-900/20 border border-red-500/30 p-3 text-sm text-red-300">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{message}
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function AISync({ onImport, onClose, selectedNodes, onSummary, defaultTab = 'extract' }: Props) {
  const providerState = useProviderState()

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          AI Integration
        </DialogTitle>
        <DialogDescription>Extract knowledge from text, or distill selected nodes into a summary.</DialogDescription>
      </DialogHeader>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="extract"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Extract</TabsTrigger>
          <TabsTrigger value="summarize" disabled={!selectedNodes?.length}>
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Summarize {selectedNodes?.length ? `(${selectedNodes.length})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="extract">
          <ExtractTab onImport={onImport} onClose={onClose} providerState={providerState} />
        </TabsContent>
        <TabsContent value="summarize">
          {selectedNodes && onSummary && (
            <SummarizeTab nodes={selectedNodes} onSummary={onSummary} onClose={onClose} providerState={providerState} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// backward-compat re-export so any old import of ClaudeSync still works during migration
export { AISync as ClaudeSync }
