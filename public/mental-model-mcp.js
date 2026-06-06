#!/usr/bin/env node
/**
 * mental-model-mcp.js — stdio MCP server for the not-mental-model knowledge graph.
 *
 * Usage:
 *   node mental-model-mcp.js [path/to/snapshot.json]
 *
 * The snapshot is a JSON array of node objects exported from the app.
 * Add to your MCP config (claude_desktop_config.json / .mcp.json):
 *
 *   {
 *     "mcpServers": {
 *       "mental-model": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/mental-model-mcp.js", "/absolute/path/to/snapshot.json"]
 *       }
 *     }
 *   }
 */
'use strict'

const fs       = require('fs')
const path     = require('path')
const readline = require('readline')

// ── Load snapshot ─────────────────────────────────────────────────────────────

const snapshotArg = process.argv[2]
const snapshotPath = snapshotArg
  ? path.resolve(snapshotArg)
  : path.join(process.env.HOME || '', '.mental-model', 'snapshot.json')

let nodes = []
try {
  nodes = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
  if (!Array.isArray(nodes)) nodes = []
} catch {
  // Start with empty graph — server still responds, just no data
}

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'memory_search',
    description: "Search the user's personal knowledge graph for nodes matching a query. Returns the most relevant facts, preferences, goals, skills, and projects.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
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
        limit:    { type: 'number', description: 'Max nodes to include (default 20)' },
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
    for (const n of items) {
      lines.push(`- **${n.title}**: ${n.content}`)
    }
    lines.push('')
  }
  lines.push('---')
  lines.push(
    'This context comes from the user\'s personal knowledge graph. ' +
    'Use it to personalize your responses and avoid asking for information you already have.'
  )
  return lines.join('\n')
}

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

// ── Message loop ──────────────────────────────────────────────────────────────

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
        capabilities: { tools: {} },
        serverInfo: { name: 'mental-model', version: '1.0.0' },
      })
      break

    case 'initialized':
    case 'notifications/initialized':
      // no-op acknowledgement
      break

    case 'tools/list':
      respond(id, { tools: TOOLS })
      break

    case 'tools/call': {
      const { name, arguments: args = {} } = params
      if (name === 'memory_search') {
        const results = searchNodes(args.query || '', args)
        const text = results.length
          ? results.map(n => `**${n.title}** (${n.category}): ${n.content}`).join('\n')
          : 'No matching memories found.'
        respond(id, { content: [{ type: 'text', text }] })
      } else if (name === 'memory_get_context') {
        respond(id, { content: [{ type: 'text', text: getContext(args) }] })
      } else {
        rpcError(id, -32601, `Unknown tool: ${name}`)
      }
      break
    }

    default:
      // Silently ignore unknown methods (notifications, pings, etc.)
      break
  }
})

rl.on('close', () => process.exit(0))
