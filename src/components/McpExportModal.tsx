import { useState } from 'react'
import { X, Download, Clipboard, ClipboardCheck, Server, ExternalLink, Terminal, Upload, Check, AlertCircle } from 'lucide-react'
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

type PushState = 'idle' | 'pushing' | 'ok' | 'error'

export function McpExportModal({ nodes, onClose }: Props) {
  const { copied: configCopied, copy: copyConfig } = useClipboard()
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('mcp-server-url') || '')
  const [serverKey, setServerKey] = useState(() => localStorage.getItem('mcp-server-key') || '')
  const [pushState, setPushState] = useState<PushState>('idle')
  const [pushError, setPushError] = useState('')

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

  async function pushSnapshot() {
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) return
    localStorage.setItem('mcp-server-url', url)
    localStorage.setItem('mcp-server-key', serverKey)
    setPushState('pushing')
    setPushError('')
    try {
      const res = await fetch(`${url}/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serverKey ? { Authorization: `Bearer ${serverKey}` } : {}),
        },
        body: JSON.stringify(snapshotActive),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setPushState('ok')
      setTimeout(() => setPushState('idle'), 3000)
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Unknown error')
      setPushState('error')
    }
  }

  function buildLocalConfig() {
    return JSON.stringify(
      {
        mcpServers: {
          'mental-model': {
            command: 'node',
            args: ['/path/to/mental-model-mcp.js', '/path/to/mental-model-snapshot.json'],
          },
        },
      },
      null, 2,
    )
  }

  function buildRemoteConfig() {
    const url = serverUrl.trim().replace(/\/$/, '') || 'https://your-server.example.com'
    return JSON.stringify(
      {
        mcpServers: {
          'mental-model': {
            type: 'sse',
            url:  `${url}/sse`,
            headers: serverKey ? { Authorization: `Bearer ${serverKey}` } : undefined,
          },
        },
      },
      null, 2,
    )
  }

  const [configMode, setConfigMode] = useState<'local' | 'remote'>('local')

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 t-text">
          <Server className="h-4 w-4 t-accent" />
          Connect to agents
        </DialogTitle>
        <DialogDescription className="t-muted">
          Expose your knowledge graph as an MCP server so any agent can query it.
        </DialogDescription>
      </DialogHeader>

      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden border t-border text-[11px]">
        <button
          className={cn('flex-1 px-3 py-1.5 transition-colors text-center',
            configMode === 'local' ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-text')}
          onClick={() => setConfigMode('local')}
        >
          Local (stdio)
        </button>
        <button
          className={cn('flex-1 px-3 py-1.5 border-l t-border transition-colors text-center',
            configMode === 'remote' ? 't-accent-subtle t-accent font-medium' : 't-muted hover:t-text')}
          onClick={() => setConfigMode('remote')}
        >
          Remote (hosted)
        </button>
      </div>

      {configMode === 'local' && (
        <>
          <div className="rounded-lg border t-border bg-white/[0.03] px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold t-text mb-2">How it works</p>
            <Step n={1} text="Download the server script and your snapshot." />
            <Step n={2} text="Put both in a permanent folder (e.g. ~/mental-model/)." />
            <Step n={3} text="Copy the config below and paste it into your agent config file." />
            <Step n={4} text="Re-export the snapshot whenever your graph changes." />
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Download</p>
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

          <ConfigBlock label="Agent config" code={buildLocalConfig()} onCopy={() => copyConfig(buildLocalConfig())} copied={configCopied} />
        </>
      )}

      {configMode === 'remote' && (
        <>
          <div className="rounded-lg border t-border bg-white/[0.03] px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold t-text mb-2">How it works</p>
            <Step n={1} text="Deploy the mcp-server/ folder to Hostinger (CI/CD is already set up on the mcp-server branch)." />
            <Step n={2} text="Enter the server URL and your API_KEY below." />
            <Step n={3} text='Push the live snapshot — agents get it instantly.' />
            <Step n={4} text="Copy the SSE config and add it to your agent." />
          </div>

          {/* Server URL + key */}
          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Server</p>
            <input
              type="url"
              placeholder="https://your-server.example.com"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              className="w-full text-xs rounded-lg border t-border bg-transparent px-3 py-1.5 t-text placeholder:t-muted outline-none focus:border-white/30"
            />
            <input
              type="password"
              placeholder="API key (MCP_API_KEY secret)"
              value={serverKey}
              onChange={e => setServerKey(e.target.value)}
              className="w-full text-xs rounded-lg border t-border bg-transparent px-3 py-1.5 t-text placeholder:t-muted outline-none focus:border-white/30"
            />
          </section>

          {/* Push snapshot */}
          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Live sync</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={pushSnapshot} disabled={!serverUrl.trim() || pushState === 'pushing'} className="flex-1">
                {pushState === 'pushing' && <span className="animate-spin mr-1.5">⟳</span>}
                {pushState === 'ok'      && <Check className="h-3.5 w-3.5 text-green-400" />}
                {pushState === 'error'   && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                {pushState === 'idle'    && <Upload className="h-3.5 w-3.5" />}
                {pushState === 'pushing' ? 'Pushing…' : pushState === 'ok' ? 'Pushed!' : 'Push snapshot'}
                <span className="ml-auto text-[10px] opacity-50">{snapshotActive.length} nodes</span>
              </Button>
            </div>
            {pushState === 'error' && (
              <p className="text-[11px] text-red-400">{pushError}</p>
            )}
          </section>

          <ConfigBlock label="Agent config (SSE)" code={buildRemoteConfig()} onCopy={() => copyConfig(buildRemoteConfig())} copied={configCopied} />
        </>
      )}

      {/* Tools reference */}
      <section className="space-y-1.5">
        <p className="text-xs font-semibold t-muted uppercase tracking-wider">Available tools</p>
        <ToolRow name="memory_search"      sig="query, limit?, category?" desc="Semantic search over your graph" />
        <ToolRow name="memory_get_context" sig="scope?, category?, limit?" desc="Full context block, optionally scoped" />
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

function ConfigBlock({ label, code, onCopy, copied }: { label: string; code: string; onCopy: () => void; copied: boolean }) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold t-muted uppercase tracking-wider">{label}</p>
      <div className="relative">
        <pre className="text-[10px] font-mono rounded-lg border t-border bg-black/30 px-3 py-2.5 overflow-x-auto t-muted leading-relaxed">{code}</pre>
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded border t-border bg-black/40 hover:bg-white/10 transition-colors"
        >
          {copied ? <ClipboardCheck className="h-3 w-3 text-green-400" /> : <Clipboard className="h-3 w-3 t-muted" />}
        </button>
      </div>
    </section>
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
