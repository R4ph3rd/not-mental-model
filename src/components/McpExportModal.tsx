import { useState } from 'react'
import { toast } from 'sonner'
import {
  X, Download, Clipboard, ClipboardCheck, Server, ExternalLink, Terminal, Bot, Zap,
  Radio, Link2, Link2Off, RefreshCw, ArrowDownToLine, Check, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { MentalModelNode } from '@/types/mental-model'
import type { SnapshotBridge } from '@/lib/snapshot-bridge'
import { cn } from '@/lib/utils'

interface Props {
  nodes: MentalModelNode[]
  bridge: SnapshotBridge
  onClose: () => void
}

type Tab = 'live' | 'mcp' | 'http'

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5)  return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// Config file paths per MCP client
const MCP_CLIENTS = [
  { name: 'Claude Desktop',  file: '~/Library/Application Support/Claude/claude_desktop_config.json',   note: '(macOS) or %APPDATA%\\Claude\\claude_desktop_config.json on Windows' },
  { name: 'Cursor',          file: '~/.cursor/mcp.json',                                               note: 'or .cursor/mcp.json in the project root' },
  { name: 'Windsurf',        file: '~/.codeium/windsurf/mcp_config.json',                              note: '' },
  { name: 'VS Code + Cline', file: '~/.vscode/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json', note: '' },
  { name: 'Continue.dev',    file: '~/.continue/config.json',                                          note: 'add under "mcpServers" key' },
  { name: 'Claude Code',     file: '~/.claude/settings.json',                                          note: 'add under "mcpServers" key' },
]

function useClipboard(ms = 2000) {
  const [copied, setCopied] = useState(false)
  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), ms)
  }
  return { copied, copy }
}

export function McpExportModal({ nodes, bridge, onClose }: Props) {
  const [tab, setTab]                             = useState<Tab>(bridge.supported ? 'live' : 'mcp')
  const [clientIdx, setClientIdx]                 = useState(0)

  async function handlePull() {
    const n = await bridge.pull()
    if (n > 0) toast(`Pulled ${n} agent ${n === 1 ? 'memory' : 'memories'}`, {
      description: 'Added as unconfirmed — review them in your graph.',
    })
    else toast('No new agent memories', { description: 'The snapshot has nothing the graph is missing.' })
  }
  const { copied: configCopied, copy: copyConfig } = useClipboard()
  const { copied: pythonCopied, copy: copyPython } = useClipboard()
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

  const mcpConfig = JSON.stringify({
    mcpServers: {
      'mental-model': {
        command: 'node',
        args: ['/abs/path/mental-model-mcp.js', '/abs/path/snapshot.json'],
      },
    },
  }, null, 2)

  const pythonSnippet = `import requests, json

BASE = "http://localhost:3456"

# Search your graph
results = requests.post(f"{BASE}/search", json={"query": "coffee preferences"}).json()

# Get full context block
ctx = requests.post(f"{BASE}/context", json={"scope": "Work"}).json()["context"]

# Add a memory from the agent
requests.post(f"{BASE}/add", json={
    "title": "Prefers async communication",
    "content": "Avoids synchronous meetings when possible.",
    "category": "preference",
})

# Get OpenAI function definitions (paste into your assistant)
fns = requests.get(f"{BASE}/openai-functions").json()`

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 t-text">
          <Server className="h-4 w-4 t-accent" />
          Connect to agents
        </DialogTitle>
        <DialogDescription className="t-muted">
          Expose your knowledge graph to Claude Desktop (MCP) or any GPT/API agent (HTTP).
        </DialogDescription>
      </DialogHeader>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border t-border p-0.5 bg-white/[0.03]">
        <TabBtn active={tab === 'live'} onClick={() => setTab('live')} icon={<Radio className="h-3 w-3" />} label="Live sync" />
        <TabBtn active={tab === 'mcp'}  onClick={() => setTab('mcp')}  icon={<Zap className="h-3 w-3" />} label="MCP" />
        <TabBtn active={tab === 'http'} onClick={() => setTab('http')} icon={<Bot className="h-3 w-3" />} label="HTTP (GPT)" />
      </div>

      {/* ── Live sync tab ─────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="space-y-4">
          <p className="text-[11px] t-muted leading-relaxed">
            Link the <code className="bg-white/8 px-1 rounded">snapshot.json</code> your MCP/HTTP server reads, once.
            The app then keeps it fresh automatically and pulls agent-written memories back for review —
            no re-exporting, no backend. Only <span className="t-text">active, non-sensitive</span> nodes are written.
          </p>

          {!bridge.supported ? (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-3 py-2.5 text-[11px] text-yellow-300/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Live sync needs the File System Access API — available in Chrome, Edge, Brave, Arc and Opera.
                In this browser, use the <button className="underline" onClick={() => setTab('mcp')}>MCP</button> or{' '}
                <button className="underline" onClick={() => setTab('http')}>HTTP</button> tab to download a snapshot manually.
              </span>
            </div>
          ) : !bridge.linked ? (
            <div className="rounded-lg border t-border bg-white/[0.03] p-4 space-y-3 text-center">
              <Radio className="h-7 w-7 mx-auto t-accent opacity-80" />
              <div className="space-y-1">
                <p className="text-sm font-medium t-text">Link your snapshot file</p>
                <p className="text-[11px] t-muted leading-relaxed">
                  Choose (or create) the <code className="bg-white/8 px-1 rounded">snapshot.json</code> you point the server at.
                  We'll seed it with your current graph right away.
                </p>
              </div>
              <Button size="sm" onClick={bridge.link} className="w-full">
                <Link2 className="h-3.5 w-3.5" />Link snapshot file
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Status card */}
              <div className="rounded-lg border t-border bg-white/[0.03] px-3 py-2.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {bridge.autoSync && <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />}
                    <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', bridge.autoSync ? 'bg-green-400' : 'bg-white/30')} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium t-text truncate">{bridge.fileName}</p>
                    <p className="text-[10px] t-muted">
                      {bridge.syncing
                        ? 'Writing…'
                        : bridge.lastSyncAt
                          ? `${bridge.syncedCount ?? 0} nodes · synced ${relativeTime(bridge.lastSyncAt)}`
                          : 'Linked — not yet synced'}
                    </p>
                  </div>
                  <button onClick={bridge.unlink} title="Unlink file"
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded border t-border t-muted hover:t-text transition-colors">
                    <Link2Off className="h-3 w-3" />
                  </button>
                </div>

                {/* Auto-sync toggle */}
                <button
                  onClick={() => bridge.setAutoSync(!bridge.autoSync)}
                  className="w-full flex items-center justify-between rounded-md border t-border px-2.5 py-1.5 hover:bg-white/[0.04] transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-[11px] t-text">
                    <RefreshCw className="h-3 w-3" />Auto-sync on every change
                  </span>
                  <span className={cn('relative h-4 w-7 rounded-full transition-colors shrink-0',
                    bridge.autoSync ? 'bg-green-500/80' : 'bg-white/15')}>
                    <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
                      bridge.autoSync ? 'left-3.5' : 'left-0.5')} />
                  </span>
                </button>
              </div>

              {bridge.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-[11px] text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{bridge.error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={bridge.syncNow} disabled={bridge.syncing} className="flex-1">
                  {bridge.syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Sync now
                </Button>
                <Button size="sm" variant="outline" onClick={handlePull} className="flex-1">
                  <ArrowDownToLine className="h-3.5 w-3.5" />Pull agent memories
                </Button>
              </div>

              <p className="text-[10px] t-muted leading-relaxed">
                Point your server at this same file:{' '}
                <code className="bg-white/8 px-1 rounded">node mental-model-mcp.js {bridge.fileName}</code>.
                Agent-written nodes arrive as <span className="text-amber-300">unconfirmed</span> for you to keep or discard.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] t-muted">Still need the server? Grab it on the <button className="underline" onClick={() => setTab('mcp')}>MCP</button> tab.</span>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5" />Close</Button>
          </div>
        </div>
      )}

      {/* ── MCP tab ──────────────────────────────────────────────────────── */}
      {tab === 'mcp' && (
        <div className="space-y-4">
          <p className="text-[11px] t-muted leading-relaxed">
            MCP is an open protocol — the same server works with <span className="t-text font-medium">Claude Desktop, Cursor, Windsurf, VS Code + Cline, Continue.dev, Claude Code</span>, and any other MCP-compatible client. Pick yours below.
          </p>

          {/* Client picker */}
          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Your MCP client</p>
            <div className="flex flex-wrap gap-1.5">
              {MCP_CLIENTS.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setClientIdx(i)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded border transition-colors',
                    clientIdx === i
                      ? 'border-white/30 bg-white/10 t-text'
                      : 't-border t-muted hover:t-text',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="text-[10px] t-muted">
              Config file: <code className="bg-white/8 px-1 rounded">{MCP_CLIENTS[clientIdx].file}</code>
              {MCP_CLIENTS[clientIdx].note && <span className="opacity-50 ml-1">{MCP_CLIENTS[clientIdx].note}</span>}
            </p>
          </section>

          <div className="rounded-lg border t-border bg-white/[0.03] px-3 py-2.5 space-y-1">
            <Step n={1} text="Download the server script and your snapshot." />
            <Step n={2} text="Put both in a permanent location (e.g. ~/mental-model/)." />
            <Step n={3} text={`Add the config block below to ${MCP_CLIENTS[clientIdx].file.split('/').pop()} — update the two paths.`} />
            <Step n={4} text="Restart / reload your client. Three tools appear automatically." />
            <Step n={5} text="Tip: the Live sync tab keeps this snapshot fresh automatically — no re-exporting." />
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

          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Config block</p>
            <div className="relative">
              <pre className="text-[10px] font-mono rounded-lg border t-border bg-black/30 px-3 py-2.5 overflow-x-auto t-muted leading-relaxed">{mcpConfig}</pre>
              <button
                onClick={() => copyConfig(mcpConfig)}
                className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded border t-border bg-black/40 hover:bg-white/10 transition-colors"
              >
                {configCopied
                  ? <ClipboardCheck className="h-3 w-3 text-green-400" />
                  : <Clipboard className="h-3 w-3 t-muted" />}
              </button>
            </div>
          </section>

          <section className="space-y-1.5">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">Tools exposed to your agent</p>
            <ToolRow name="memory_search"      sig="query, limit?, category?"  desc="Search your graph" />
            <ToolRow name="memory_get_context" sig="scope?, category?, limit?" desc="Full context block" />
            <ToolRow name="memory_add"         sig="title, content, category?" desc="Write a node back (unconfirmed until you review)" />
          </section>

          <div className="flex items-center justify-between pt-1">
            <a href="https://modelcontextprotocol.io/introduction" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[11px] t-muted hover:t-text transition-colors">
              <ExternalLink className="h-3 w-3" />MCP docs
            </a>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5" />Close</Button>
          </div>
        </div>
      )}

      {/* ── HTTP tab ─────────────────────────────────────────────────────── */}
      {tab === 'http' && (
        <div className="space-y-4">
          <div className="rounded-lg border t-border bg-white/[0.03] px-3 py-2.5 space-y-1">
            <Step n={1} text="Download the server and snapshot." />
            <Step n={2} text='Start the HTTP server: node mental-model-mcp.js snapshot.json --http' />
            <Step n={3} text="Call the REST endpoints from your code, or fetch /openai-functions for function definitions." />
            <Step n={4} text="Agent-added nodes (/add) are written to the snapshot — re-import to review them in the app." />
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">1 · Download</p>
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

          <section className="space-y-1.5">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">2 · HTTP endpoints (port 3456)</p>
            <EndpointRow method="GET"  path="/nodes"            desc="All visible nodes as JSON" />
            <EndpointRow method="POST" path="/search"           desc='{ query, limit?, category? }' />
            <EndpointRow method="POST" path="/context"          desc='{ scope?, category?, limit? }' />
            <EndpointRow method="POST" path="/add"              desc='{ title, content, category?, importance?, tags? }' />
            <EndpointRow method="GET"  path="/openai-functions" desc="OpenAI function-calling definitions" />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wider">3 · Python example</p>
            <div className="relative">
              <pre className="text-[10px] font-mono rounded-lg border t-border bg-black/30 px-3 py-2.5 overflow-x-auto t-muted leading-relaxed">{pythonSnippet}</pre>
              <button
                onClick={() => copyPython(pythonSnippet)}
                className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded border t-border bg-black/40 hover:bg-white/10 transition-colors"
              >
                {pythonCopied
                  ? <ClipboardCheck className="h-3 w-3 text-green-400" />
                  : <Clipboard className="h-3 w-3 t-muted" />}
              </button>
            </div>
            <p className="text-[10px] t-muted">
              For the OpenAI Assistants API, download the snapshot and upload it as a file for retrieval — no server needed.
            </p>
          </section>

          <div className="flex justify-end pt-1">
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3.5 w-3.5" />Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md transition-colors',
        active ? 'bg-white/10 t-text' : 't-muted hover:t-text',
      )}
    >
      {icon}{label}
    </button>
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

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = method === 'GET' ? 'text-blue-400' : 'text-green-400'
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={cn('shrink-0 text-[10px] font-mono font-semibold w-8', methodColor)}>{method}</span>
      <code className="shrink-0 text-[10px] bg-white/8 border t-border rounded px-1.5 py-0.5 t-accent font-mono">{path}</code>
      <span className="t-muted ml-auto text-right text-[10px]">{desc}</span>
    </div>
  )
}
