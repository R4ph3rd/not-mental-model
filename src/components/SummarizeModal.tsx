import { useState } from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ProviderPicker } from '@/components/shared/ProviderPicker'
import { callProvider, getDefaultProvider } from '@/lib/providers'
import { SUMMARIZE_SYSTEM } from '@/lib/prompts'
import type { MentalModelNode } from '@/types/mental-model'

interface Props {
  nodes: MentalModelNode[]
  onSummary: (s: { title: string; content: string; tags: string[]; scope: string }) => void
  onClose: () => void
}

export function SummarizeModal({ nodes, onSummary, onClose }: Props) {
  const [provider, setProvider] = useState(getDefaultProvider)
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
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 t-text">
          <Layers className="h-4 w-4 t-accent" />
          Summarize {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        </DialogTitle>
        <DialogDescription className="t-muted">
          Distil selected nodes into a single high-level semantic memory.
        </DialogDescription>
      </DialogHeader>

      <ProviderPicker value={provider} onChange={setProvider} />

      <div className="rounded-lg t-card border t-border p-3 space-y-1 max-h-40 overflow-y-auto">
        {nodes.map(n => (
          <p key={n.id} className="text-xs t-muted">· <span className="t-text">{n.title}</span></p>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-3 text-xs text-red-300">{error}</div>
      )}

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
