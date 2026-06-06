import { useState } from 'react'
import { X, Download, Clipboard, ClipboardCheck, Server, ExternalLink, Terminal, Bot, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { MentalModelNode } from '@/types/mental-model'
import { cn } from '@/lib/utils'

interface Props {
  nodes: MentalModelNode[]
  onClose: () => void
}

type Tab = 'mcp' | 'http'

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

export function McpExportModal({ nodes, onClose }: Props) {
  const [tab, setTab]                             = useState<Tab>('mcp')
  const [clientIdx, setClientIdx]                 = useState(0)
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
        <TabBtn active={tab === 'mcp'}  onClick={() => setTab('mcp')}  icon={<Zap className="h-3 w-3" />} label="MCP (any agent)" />
        <TabBtn active={tab === 'http'} onClick={() => setTab('http')} icon={<Bot className="h-3 w-3" />} label="HTTP (GPT / API)" />
      </div>

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
            <Step n={5} text="Re-export snapshot here whenever your graph changes." />
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
