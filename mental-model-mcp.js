#!/usr/bin/env node
/**
 * mental-model-mcp.js — MCP server (stdio) + optional HTTP server for the
 * not-mental-model knowledge graph.
 *
 * ── Claude Desktop / any MCP client (stdio) ──────────────────────────────────
 *   node mental-model-mcp.js [snapshot.json]
 *
 * Add to claude_desktop_config.json or .mcp.json:
 *   {
 *     "mcpServers": {
 *       "mental-model": {
 *         "command": "node",
 *         "args": ["/abs/path/mental-model-mcp.js", "/abs/path/snapshot.json"]
 *       }
 *     }
 *   }
 *
 * ── GPT / OpenAI / any HTTP client ───────────────────────────────────────────
 *   node mental-model-mcp.js [snapshot.json] --http [port]   # default port 3456
 *
 * Endpoints:
 *   GET  /nodes            → all visible nodes as JSON
 *   POST /search           → { query, limit?, category? }
 *   POST /context          → { scope?, category?, limit? }
 *   POST /add              → { title, content, category?, importance?, tags? }
 *   GET  /openai-functions → OpenAI function-calling definitions (JSON)
 *
 * Re-import the snapshot into the app to sync agent-added nodes back.
 */
import fs       from 'fs'
import path     from 'path'
import readline from 'readline'
import http     from 'http'
import { randomUUID } from 'crypto'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const httpFlagIdx = args.indexOf('--http')
const httpMode    = httpFlagIdx !== -1
const httpPort    = httpMode ? (parseInt(args[httpFlagIdx + 1], 10) || 3456) : null
const snapshotArg = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a))

const snapshotPath = snapshotArg
  ? path.resolve(snapshotArg)
  : path.join(process.env.HOME || '', '.mental-model', 'snapshot.json')

// ── Snapshot I/O ──────────────────────────────────────────────────────────────

function loadNodes() {
  try {
    const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveNodes(nodes) {
  try {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
    fs.writeFileSync(snapshotPath, JSON.stringify(nodes, null, 2))
    return true
  } catch {
    return false
  }
}

let nodes = loadNodes()

// ── Tool implementations ──────────────────────────────────────────────────────

function visibleNodes() {
  return nodes.filter(n => n.active !== false && !n.sensitive)
}

function searchNodes(query, { limit = 10, category } = {}) {
  const q = (query || '').toLowerCase()
  if (!q) return visibleNodes().slice(0, limit)
  let pool = visibleNodes()
  if (category) pool = pool.filter(n => n.category === category)
  return pool
    .map(n => {
      const score =
        (n.title.toLowerCase().includes(q) ? 3 : 0) +
        (n.content.toLowerCase().includes(q) ? 1 : 0) +
        ((n.tags || []).some(t => t.toLowerCase().includes(q)) ? 0.5 : 0)
      return { n, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.n.importance || 0.5) - (a.n.importance || 0.5))
    .slice(0, limit)
    .map(x => x.n)
}

function getContext({ scope, category, limit = 20 } = {}) {
  let pool = visibleNodes()
  if (scope)    pool = pool.filter(n => n.scope?.toLowerCase() === scope.toLowerCase())
  if (category) pool = pool.filter(n => n.category === category)
  pool = pool.sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5)).slice(0, limit)

  if (!pool.length) return 'No matching knowledge graph entries found.'

  const grouped = {}
  for (const n of pool) {
    const k = n.category.charAt(0).toUpperCase() + n.category.slice(1) + 's'
    ;(grouped[k] ??= []).push(n)
  }
  const date      = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const scopeTag  = scope ? ` (${scope})` : ''
  const lines     = [`## User knowledge graph${scopeTag} — ${date}\n`]
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`### ${cat}`)
    for (const n of items) lines.push(`- **${n.title}**: ${n.content}`)
    lines.push('')
  }
  lines.push('---')
  lines.push("This context comes from the user's personal knowledge graph. Use it to personalise your responses.")
  return lines.join('\n')
}

function addNode({ title, content, category = 'fact', importance = 0.6, tags = [] } = {}) {
  if (!title || !content) return { error: 'title and content are required' }
  const node = {
    id:          randomUUID(),
    title,
    content,
    category,
    importance,
    tags,
    confidence:  'medium',
    memoryType:  'semantic',
    provenance:  'agent',
    confirmed:   false,
    active:      true,
    sensitive:   false,
    pinned:      false,
    source:      'agent',
    linkedNodeIds: [],
    conversationIds: [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  }
  nodes.push(node)
  saveNodes(nodes)
  return { id: node.id, message: `Added "${title}" as an unconfirmed agent node. Re-import the snapshot into the app to review it.` }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'memory_search',
    description: "Search the user's personal knowledge graph. Returns the most relevant facts, preferences, goals, skills, and projects matching the query.",
    inputSchema: {
      type: 'object',
      properties: {
        query:    { type: 'string',  description: 'Natural-language search query' },
        limit:    { type: 'number',  description: 'Max results (default 10)' },
        category: { type: 'string',  enum: ['fact','preference','goal','skill','project','conversation'], description: 'Filter by category' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_get_context',
    description: "Return a formatted markdown context block from the user's knowledge graph. Use this to prime a conversation with relevant background about the user.",
    inputSchema: {
      type: 'object',
      properties: {
        scope:    { type: 'string', description: 'Filter by scope (e.g. "Work", "Personal", "Skills")' },
        category: { type: 'string', enum: ['fact','preference','goal','skill','project','conversation'], description: 'Filter by category' },
        limit:    { type: 'number', description: 'Max nodes to include (default 20)' },
      },
    },
  },
  {
    name: 'memory_add',
    description: "Add a new memory node to the user's knowledge graph. The node will be saved as an unconfirmed agent node — the user reviews it in the app.",
    inputSchema: {
      type: 'object',
      properties: {
        title:      { type: 'string', description: 'Short, descriptive title for the memory' },
        content:    { type: 'string', description: 'Full content / detail of the memory' },
        category:   { type: 'string', enum: ['fact','preference','goal','skill','project'], description: 'Node category (default: fact)' },
        importance: { type: 'number', description: '0–1 importance weight (default 0.6)' },
        tags:       { type: 'array',  items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['title', 'content'],
    },
  },
]

// OpenAI function-calling equivalents (for GPT / Assistants API)
const OPENAI_FUNCTIONS = TOOLS.map(t => ({
  type:     'function',
  function: { name: t.name, description: t.description, parameters: t.inputSchema },
}))

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}
function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}
function rpcError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function handleToolCall(id, name, args) {
  if (name === 'memory_search') {
    const results = searchNodes(args.query || '', args)
    const text = results.length
      ? results.map(n => `**${n.title}** (${n.category}): ${n.content}`).join('\n')
      : 'No matching memories found.'
    respond(id, { content: [{ type: 'text', text }] })
  } else if (name === 'memory_get_context') {
    respond(id, { content: [{ type: 'text', text: getContext(args) }] })
  } else if (name === 'memory_add') {
    const result = addNode(args)
    const text = result.error ? `Error: ${result.error}` : result.message
    respond(id, { content: [{ type: 'text', text }] })
  } else {
    rpcError(id, -32601, `Unknown tool: ${name}`)
  }
}

// ── Stdio MCP loop ─────────────────────────────────────────────────────────────

function startStdio() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false })

  rl.on('line', rawLine => {
    const line = rawLine.trim()
    if (!line) return
    let req
    try { req = JSON.parse(line) } catch { return }

    const { id, method, params = {} } = req

    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: '2024-11-05',
          capabilities:    { tools: {} },
          serverInfo:      { name: 'mental-model', version: '1.1.0' },
        })
        break

      case 'initialized':
      case 'notifications/initialized':
        // notification — no response required
        break

      case 'ping':
        respond(id, {})
        break

      case 'tools/list':
        respond(id, { tools: TOOLS })
        break

      case 'tools/call':
        handleToolCall(id, params.name, params.arguments ?? {})
        break

      default:
        // Silently ignore unknown methods / notifications
        break
    }
  })

  rl.on('close', () => process.exit(0))
}

// ── HTTP server (GPT / API mode) ──────────────────────────────────────────────

function startHttp(port) {
  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  function json(res, status, data) {
    const body = JSON.stringify(data, null, 2)
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
    res.end(body)
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Invalid JSON')) } })
      req.on('error', reject)
    })
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS)
      res.end()
      return
    }

    // GET /nodes
    if (req.method === 'GET' && url.pathname === '/nodes') {
      return json(res, 200, visibleNodes())
    }

    // GET /openai-functions
    if (req.method === 'GET' && url.pathname === '/openai-functions') {
      return json(res, 200, OPENAI_FUNCTIONS)
    }

    // POST /search
    if (req.method === 'POST' && url.pathname === '/search') {
      const body = await readBody(req).catch(() => ({}))
      return json(res, 200, searchNodes(body.query || '', body))
    }

    // POST /context
    if (req.method === 'POST' && url.pathname === '/context') {
      const body = await readBody(req).catch(() => ({}))
      return json(res, 200, { context: getContext(body) })
    }

    // POST /add
    if (req.method === 'POST' && url.pathname === '/add') {
      const body = await readBody(req).catch(() => null)
      if (!body) return json(res, 400, { error: 'Invalid JSON body' })
      const result = addNode(body)
      return json(res, result.error ? 400 : 201, result)
    }

    json(res, 404, { error: 'Not found' })
  })

  server.listen(port, () => {
    process.stderr.write(`mental-model HTTP server running on http://localhost:${port}\n`)
    process.stderr.write(`  GET  /nodes             — list all visible nodes\n`)
    process.stderr.write(`  POST /search            — { query, limit?, category? }\n`)
    process.stderr.write(`  POST /context           — { scope?, category?, limit? }\n`)
    process.stderr.write(`  POST /add               — { title, content, category?, importance?, tags? }\n`)
    process.stderr.write(`  GET  /openai-functions  — OpenAI function-calling definitions\n`)
  })
}

// ── Entry point ────────────────────────────────────────────────────────────────

if (httpMode) {
  startHttp(httpPort)
} else {
  startStdio()
}
