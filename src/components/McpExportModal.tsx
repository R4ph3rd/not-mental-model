import { useState } from 'react'
import { X, Download, Clipboard, ClipboardCheck, Server, ExternalLink, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { MentalModelNode } from '@/types/mental-model'
import { cn } from '@/lib/utils'

interface Props {
  nodes: MentalModelNode[]
  onClose: () => void
}

function useClipboard(ms = 2000) {
  const [copied, setCopied] = useState(false)
  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), ms)
  }
  return { copied, copy }
}

export function McpExportModal({ nodes, onClose }: Props) {
  const { copied: configCopied, copy: copyConfig } = useClipboard()
  const snapshotActive = nodes.filter(n => n.active !== false && !n.sensitive)

  function downloadSnapshot() {
    const blob = new Blob([JSON.stringify(snapshotActive, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'mental-model-snapshot.json'
    a.click()
  }

  function downloadServer() {
    const a = document.createElement('a')
    a.href = '/mental-model-mcp.js'
    a.download = 'mental-model-mcp.js'
    a.click()
  }

  function buildMcpConfig(serverPath: string, snapshotPath: string) {
    return JSON.stringify(
      {
        mcpServers: {
          'mental-model': {
            command: 'node',
            args: [serverPath, snapshotPath],
          },
        },
      },
      null,
      2,
    )
  }

  function handleCopyConfig() {
    const cfg = buildMcpConfig(
      '/path/to/mental-model-mcp.js',
      '/path/to/mental-model-snapshot.json',
    )
    copyConfig(cfg)
  }

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 t-text">
          <Server className="h-4 w-4 t-accent" />
          Connect to agents
        </DialogTitle>
        <DialogDescription className="t-muted">
          Expose your knowledge graph as an MCP server so any agent can query it directly.
        </DialogDescription>
      </DialogHeader>

      {/* How it works */}
      <div className="rounded-lg border t-border bg-white/[0.03] px-4 py-3 space-y-1">
        <p className="text-xs font-semibold t-text mb-2">How it works</p>
        <Step n={1} text="Download the MCP server script and your snapshot below." />
        <Step n={2} text='Put both files somewhere permanent (e.g. ~/mental-model/).' />
        <Step n={3} text="Copy the MCP config and add it to your agent config file." />
        <Step n={4} text="Re-export the snapshot whenever your graph changes." />
      </div>

      {/* Step 1 — download */}
      <section className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wider">1 · Download files</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadServer} className="flex-1">
            <Terminal className="h-3.5 w-3.5" />mental-model-mcp.js
            <Download className="h-3 w-3 ml-auto opacity-60" />
          </Button>
          <Button size="sm" variant="outline" onClick={downloadSnapshot} className="flex-1">
            <Download className="h-3.5 w-3.5" />snapshot.json
            <span className="ml-auto text-[10px] opacity-50">{snapshotActive.length} nodes</span>
          </Button>
        </div>
      </section>

      {/* Step 2 — MCP config */}
      <section className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wider">2 · Add to agent config</p>
        <p className="text-[11px] t-muted">
          Paste this into <code className="text-[10px] bg-white/8 px-1 py-0.5 rounded">claude_desktop_config.json</code>,
          {' '}<code className="text-[10px] bg-white/8 px-1 py-0.5 rounded">.mcp.json</code>,
          {' '}or your agent's MCP settings — then update the two paths.
        </p>
        <div className="relative">
          <pre className={cn(
            'text-[10px] font-mono rounded-lg border t-border bg-black/30 px-3 py-2.5 overflow-x-auto t-muted leading-relaxed',
          )}>{buildMcpConfig('/path/to/mental-model-mcp.js', '/path/to/mental-model-snapshot.json')}</pre>
          <button
            onClick={handleCopyConfig}
            className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded border t-border bg-black/40 hover:bg-white/10 transition-colors"
          >
            {configCopied
              ? <ClipboardCheck className="h-3 w-3 text-green-400" />
              : <Clipboard className="h-3 w-3 t-muted" />}
          </button>
        </div>
      </section>

      {/* Tools reference */}
      <section className="space-y-1.5">
        <p className="text-xs font-semibold t-muted uppercase tracking-wider">Available tools</p>
        <ToolRow name="memory_search" sig='query, limit?, category?' desc="Semantic search over your graph" />
        <ToolRow name="memory_get_context" sig='scope?, category?, limit?' desc="Full context block, optionally scoped" />
      </section>

      <div className="flex items-center justify-between pt-1">
        <a
          href="https://modelcontextprotocol.io/docs/concepts/servers"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] t-muted hover:t-text transition-colors"
        >
          <ExternalLink className="h-3 w-3" />MCP docs
        </a>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-3.5 w-3.5" />Close
        </Button>
      </div>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px] t-muted">
      <span className="shrink-0 h-4 w-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold t-text">{n}</span>
      {text}
    </div>
  )
}

function ToolRow({ name, sig, desc }: { name: string; sig: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <code className="shrink-0 text-[10px] bg-white/8 border t-border rounded px-1.5 py-0.5 t-accent font-mono">{name}</code>
      <span className="t-muted font-mono opacity-60 text-[10px] mt-0.5">{sig}</span>
      <span className="t-muted ml-auto text-right">{desc}</span>
    </div>
  )
}
