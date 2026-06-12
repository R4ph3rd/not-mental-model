'use strict'

/**
 * mental-model-mcp-server — HTTP MCP server with SSE transport.
 *
 * Agents connect to GET /sse to receive SSE events and POST /message to send
 * JSON-RPC requests. This follows the MCP HTTP+SSE transport spec.
 *
 * Environment variables:
 *   PORT          — TCP port to listen on (default 3741)
 *   API_KEY       — Bearer token required for all requests (required in production)
 *   SNAPSHOT_FILE — Path to the snapshot JSON file (default ./snapshot.json)
 *
 * The app pushes a fresh snapshot via:
 *   POST /snapshot
 *   Authorization: Bearer $API_KEY
 *   Content-Type: application/json
 *   Body: JSON array of MentalModelNode objects
 */

const express = require('express')
const cors    = require('cors')
const fs      = require('fs')
const path    = require('path')
const crypto  = require('crypto')

const PORT          = parseInt(process.env.PORT || '3741', 10)
const API_KEY       = process.env.API_KEY || ''
const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || path.join(__dirname, 'snapshot.json')

if (!API_KEY) {
  console.warn('[mcp] WARNING: API_KEY is not set. Server is unprotected.')
}

// ── Snapshot store ────────────────────────────────────────────────────────────

let nodes = []

function loadSnapshot() {
  try {
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) { nodes = parsed; return true }
  } catch { /* no file yet */ }
  return false
}

function saveSnapshot(data) {
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2), 'utf8')
  nodes = data
}

loadSnapshot()

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'memory_search',
    description: "Search the user's personal knowledge graph for nodes matching a query. Returns the most relevant facts, preferences, goals, skills, and projects.",
    inputSchema: {
      type: 'object',
      properties: {
        query:    { type: 'string', description: 'Natural language search query' },
        limit:    { type: 'number', description: 'Max results to return (default 10)' },
        category: {
          type: 'string',
          enum: ['fact', 'preference', 'goal', 'skill', 'project', 'conversation'],
          description: 'Optional: filter by node category',
        },
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
        scope:    { type: 'string', description: 'Filter by scope label (e.g. "Work", "Personal", "Skills")' },
        category: {
          type: 'string',
          enum: ['fact', 'preference', 'goal', 'skill', 'project', 'conversation'],
          description: 'Optional: return only nodes of this category',
        },
        limit: { type: 'number', description: 'Max nodes to include (default 20)' },
      },
    },
  },
]

// ── Tool implementations ──────────────────────────────────────────────────────

function visibleNodes() {
  return nodes.filter(n => n.active !== false && !n.sensitive)
}

function searchNodes(query, { limit = 10, category } = {}) {
  const q = query.toLowerCase()
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
  if (scope)    pool = pool.filter(n => n.scope && n.scope.toLowerCase() === scope.toLowerCase())
  if (category) pool = pool.filter(n => n.category === category)
  pool = pool.sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5)).slice(0, limit)

  if (pool.length === 0) return 'No matching knowledge graph entries found.'

  const grouped = {}
  for (const n of pool) {
    const k = n.category.charAt(0).toUpperCase() + n.category.slice(1) + 's'
    ;(grouped[k] = grouped[k] || []).push(n)
  }
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const scopeLabel = scope ? ` (${scope})` : ''
  const lines = [`## User knowledge graph${scopeLabel} — ${date}\n`]
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`### ${cat}`)
    for (const n of items) lines.push(`- **${n.title}**: ${n.content}`)
    lines.push('')
  }
  return lines.join('\n')
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!API_KEY) return next() // dev mode: no auth
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(API_KEY))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── SSE session manager ───────────────────────────────────────────────────────

const sessions = new Map() // sessionId → res

function createSession(res) {
  const id = crypto.randomUUID()
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  sessions.set(id, res)
  res.on('close', () => sessions.delete(id))

  // Send the endpoint URL for the client to POST messages to
  res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: `/message?session=${id}` })}\n\n`)

  return id
}

function sendToSession(sessionId, data) {
  const res = sessions.get(sessionId)
  if (res) res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ── MCP JSON-RPC handler ──────────────────────────────────────────────────────

function handleRpc(req, sessionId) {
  const { id, method, params = {} } = req

  function respond(result) {
    sendToSession(sessionId, { jsonrpc: '2.0', id, result })
  }
  function rpcError(code, message) {
    sendToSession(sessionId, { jsonrpc: '2.0', id, error: { code, message } })
  }

  switch (method) {
    case 'initialize':
      respond({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mental-model', version: '1.0.0' },
      })
      break

    case 'initialized':
    case 'notifications/initialized':
      break

    case 'tools/list':
      respond({ tools: TOOLS })
      break

    case 'tools/call': {
      const { name, arguments: args = {} } = params
      if (name === 'memory_search') {
        const results = searchNodes(args.query || '', args)
        const text = results.length
          ? results.map(n => `**${n.title}** (${n.category}): ${n.content}`).join('\n')
          : 'No matching memories found.'
        respond({ content: [{ type: 'text', text }] })
      } else if (name === 'memory_get_context') {
        respond({ content: [{ type: 'text', text: getContext(args) }] })
      } else {
        rpcError(-32601, `Unknown tool: ${name}`)
      }
      break
    }

    default:
      // Silently ignore unknown notifications
      if (id !== undefined) rpcError(-32601, `Method not found: ${method}`)
      break
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ ok: true, nodes: nodes.length, uptime: process.uptime() })
})

// SSE endpoint — agents connect here
app.get('/sse', requireAuth, (req, res) => {
  createSession(res)
})

// Message endpoint — agents POST JSON-RPC here
app.post('/message', requireAuth, (req, res) => {
  const sessionId = req.query.session
  if (!sessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' })
  }
  handleRpc(req.body, sessionId)
  res.status(202).end()
})

// Snapshot push endpoint — the app calls this to update the graph
app.post('/snapshot', requireAuth, (req, res) => {
  const data = req.body
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must be a JSON array of nodes' })
  }
  saveSnapshot(data)
  console.log(`[mcp] Snapshot updated: ${data.length} nodes`)
  res.json({ ok: true, count: data.length })
})

app.listen(PORT, () => {
  console.log(`[mcp] Mental model MCP server listening on port ${PORT}`)
  console.log(`[mcp] Snapshot: ${SNAPSHOT_FILE} (${nodes.length} nodes loaded)`)
  if (!API_KEY) console.warn('[mcp] Running without auth — set API_KEY in production')
})
