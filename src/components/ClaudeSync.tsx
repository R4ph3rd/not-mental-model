import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { MentalModelNode } from '@/types/mental-model'

interface Props {
  onImport: (nodes: MentalModelNode[]) => void
  onClose: () => void
}

const SYSTEM_PROMPT = `You are an assistant that extracts structured knowledge from a conversation transcript to build a mental model of the user.

Extract facts, preferences, skills, goals, projects, and notable conversation topics. Return ONLY a valid JSON array of objects with this shape:
{
  "id": "node-<random>",
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label",
  "content": "detailed description",
  "tags": ["tag1", "tag2"],
  "confidence": "high"|"medium"|"low",
  "source": "extracted",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>",
  "linkedIds": []
}

Be specific, concise, and accurate. Only include what can be reliably inferred from the text.`

async function extractWithClaude(apiKey: string, text: string): Promise<MentalModelNode[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract mental model nodes from this text:\n\n${text}` }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `API error ${response.status}`)
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> }
  const raw = data.content.find(c => c.type === 'text')?.text ?? '[]'

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON array found in response')

  return JSON.parse(jsonMatch[0]) as MentalModelNode[]
}

export function ClaudeSync({ onImport, onClose }: Props) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mm-claude-key') ?? '')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MentalModelNode[] | null>(null)

  async function handleExtract() {
    if (!apiKey.trim() || !text.trim()) return
    localStorage.setItem('mm-claude-key', apiKey.trim())
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const nodes = await extractWithClaude(apiKey.trim(), text.trim())
      setPreview(nodes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function handleImport() {
    if (preview) {
      onImport(preview)
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Extract with Claude
        </DialogTitle>
        <DialogDescription>
          Paste a conversation or notes — Claude will extract knowledge nodes into your mental model.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Anthropic API key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
        />
        <p className="text-[10px] text-white/30">Stored only in localStorage, never sent anywhere but Anthropic.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wide">Conversation / Notes</label>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste a conversation transcript, notes, or any text describing the user..."
          rows={6}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-900/20 border border-red-500/30 p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-md bg-green-900/10 border border-green-500/20 p-3 space-y-1">
          <p className="text-xs text-green-400 font-medium">{preview.length} nodes extracted</p>
          {preview.map(n => (
            <p key={n.id} className="text-xs text-white/60">· <span className="text-white/80">{n.title}</span> ({n.category})</p>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {preview ? (
          <Button onClick={handleImport}>
            Import {preview.length} nodes
          </Button>
        ) : (
          <Button onClick={handleExtract} disabled={loading || !apiKey.trim() || !text.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Extract
          </Button>
        )}
      </div>
    </div>
  )
}
