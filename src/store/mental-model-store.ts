import { useState, useCallback } from 'react'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType } from '@/types/mental-model'

const STORAGE_KEY = 'mental-model-nodes'

function generateId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function now() {
  return new Date().toISOString()
}

// Migrate old nodes missing new fields
function migrate(raw: Partial<MentalModelNode>): MentalModelNode {
  return {
    id: raw.id ?? generateId(),
    category: raw.category ?? 'fact',
    title: raw.title ?? '',
    content: raw.content ?? '',
    tags: raw.tags ?? [],
    confidence: raw.confidence ?? 'medium',
    source: raw.source,
    createdAt: raw.createdAt ?? now(),
    updatedAt: raw.updatedAt ?? now(),
    linkedIds: raw.linkedIds ?? [],
    active: raw.active ?? true,
    pinned: raw.pinned ?? false,
    memoryType: raw.memoryType ?? 'semantic',
    scope: raw.scope ?? '',
    importance: raw.importance ?? 0.8,
    position: raw.position,
  }
}

function load(): MentalModelNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultNodes()
    const parsed = JSON.parse(raw) as Partial<MentalModelNode>[]
    return parsed.map(migrate)
  } catch {
    return defaultNodes()
  }
}

function persist(nodes: MentalModelNode[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

function defaultNodes(): MentalModelNode[] {
  return [
    // ── Projects ──────────────────────────────────────────────────
    {
      id: 'demo-proj-1',
      category: 'project',
      title: 'Not-a-mental-model',
      content: 'Building a React + shadcn/ui interface for managing an AI agent\'s knowledge base about the user. Inspired by HCI papers: Memory Sandbox, CHI \'25, Xu 2025. Goal: transparent, user-controlled agent memory.',
      tags: ['react', 'typescript', 'claude', 'hci'],
      confidence: 'high', source: 'conversation',
      createdAt: daysAgo(12), updatedAt: daysAgo(0),
      linkedIds: ['demo-conv-1', 'demo-skill-1'],
      active: true, pinned: true, memoryType: 'episodic', scope: 'Work', importance: 1.0,
    },
    {
      id: 'demo-proj-2',
      category: 'project',
      title: 'Personal finance tracker',
      content: 'Side project: a self-hosted dashboard to track personal expenses, savings rate, and portfolio allocation. Uses Python + FastAPI backend, React frontend. Deployed on a VPS.',
      tags: ['python', 'finance', 'side-project'],
      confidence: 'high', source: 'conversation',
      createdAt: daysAgo(45), updatedAt: daysAgo(8),
      linkedIds: ['demo-skill-2'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Side projects', importance: 0.7,
    },
    {
      id: 'demo-proj-3',
      category: 'project',
      title: 'LLM eval harness',
      content: 'Research project: building a lightweight eval harness to benchmark LLM outputs on domain-specific tasks. Focused on reproducibility and cheap-to-run evals without expensive APIs.',
      tags: ['llm', 'eval', 'research', 'python'],
      confidence: 'medium', source: 'conversation',
      createdAt: daysAgo(30), updatedAt: daysAgo(15),
      linkedIds: ['demo-skill-2', 'demo-goal-2'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Research', importance: 0.8,
    },

    // ── Skills ────────────────────────────────────────────────────
    {
      id: 'demo-skill-1',
      category: 'skill',
      title: 'TypeScript & React',
      content: 'Expert-level. Comfortable with advanced patterns: custom hooks, context, render optimisation, component libraries. Full-stack TS experience (Vite, Next.js, tRPC).',
      tags: ['typescript', 'react', 'frontend'],
      confidence: 'high', source: 'observed',
      createdAt: daysAgo(60), updatedAt: daysAgo(5),
      linkedIds: ['demo-proj-1'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.95,
    },
    {
      id: 'demo-skill-2',
      category: 'skill',
      title: 'Python & data engineering',
      content: 'Proficient in Python for scripting, data pipelines, and ML tooling. Familiar with pandas, polars, FastAPI, and lightweight ML workflows. Prefers typed Python with mypy.',
      tags: ['python', 'data', 'ml'],
      confidence: 'high', source: 'conversation',
      createdAt: daysAgo(90), updatedAt: daysAgo(20),
      linkedIds: ['demo-proj-2', 'demo-proj-3'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.85,
    },
    {
      id: 'demo-skill-3',
      category: 'skill',
      title: 'System design & architecture',
      content: 'Comfortable designing distributed systems, APIs, and event-driven architectures. Prefers pragmatic over over-engineered solutions. Experience with monolith-first, then extract approach.',
      tags: ['architecture', 'system-design', 'backend'],
      confidence: 'medium', source: 'inferred',
      createdAt: daysAgo(60), updatedAt: daysAgo(25),
      linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.75,
    },

    // ── Preferences ───────────────────────────────────────────────
    {
      id: 'demo-pref-1',
      category: 'preference',
      title: 'Dark, minimal UIs',
      content: 'Consistently prefers dark-themed interfaces with high information density and minimal chrome. Dislikes verbose UI copy, excessive animations, and over-padded layouts.',
      tags: ['ui', 'design', 'aesthetics'],
      confidence: 'high', source: 'observed',
      createdAt: daysAgo(80), updatedAt: daysAgo(3),
      linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.9,
    },
    {
      id: 'demo-pref-2',
      category: 'preference',
      title: 'Short, direct AI responses',
      content: 'Dislikes preamble ("Sure, I\'d be happy to…"), unnecessary caveats, and over-explanation. Prefers code-first answers with reasoning only when non-obvious.',
      tags: ['ai', 'communication', 'style'],
      confidence: 'high', source: 'direct',
      createdAt: daysAgo(20), updatedAt: daysAgo(2),
      linkedIds: [],
      active: true, pinned: true, memoryType: 'semantic', scope: 'Personal', importance: 1.0,
    },
    {
      id: 'demo-pref-3',
      category: 'preference',
      title: 'Keyboard-first workflows',
      content: 'Prefers tools that support keyboard navigation and shortcuts. Frequently uses Vim motions, tmux, and terminal-based workflows. Mouse usage is a last resort.',
      tags: ['keyboard', 'productivity', 'tools'],
      confidence: 'medium', source: 'observed',
      createdAt: daysAgo(50), updatedAt: daysAgo(14),
      linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.7,
    },

    // ── Goals ─────────────────────────────────────────────────────
    {
      id: 'demo-goal-1',
      category: 'goal',
      title: 'Build transparent AI-native tools',
      content: 'Wants to create interfaces that expose AI behaviour and give users genuine control. Motivated by HCI research on human-AI collaboration and agent oversight.',
      tags: ['ai', 'product', 'hci', 'transparency'],
      confidence: 'high', source: 'inferred',
      createdAt: daysAgo(40), updatedAt: daysAgo(10),
      linkedIds: ['demo-proj-1'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Goals', importance: 0.85,
    },
    {
      id: 'demo-goal-2',
      category: 'goal',
      title: 'Publish LLM eval research',
      content: 'Aiming to write up findings from the eval harness project as a blog post or short paper. Target audience: ML engineers who want cheap, reproducible evals without benchmark contamination.',
      tags: ['research', 'writing', 'llm'],
      confidence: 'low', source: 'conversation',
      createdAt: daysAgo(25), updatedAt: daysAgo(18),
      linkedIds: ['demo-proj-3'],
      active: false, pinned: false, memoryType: 'semantic', scope: 'Goals', importance: 0.5,
    },

    // ── Facts ─────────────────────────────────────────────────────
    {
      id: 'demo-fact-1',
      category: 'fact',
      title: 'Works in Paris, CET timezone',
      content: 'Based in Paris, France. Works on CET / CEST timezone (UTC+1/+2). Scheduling and deadline references should use this timezone by default.',
      tags: ['location', 'timezone'],
      confidence: 'high', source: 'direct',
      createdAt: daysAgo(100), updatedAt: daysAgo(100),
      linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.8,
    },
    {
      id: 'demo-fact-2',
      category: 'fact',
      title: 'Preferred stack: Vite + React + TS',
      content: 'Default frontend stack is Vite + React + TypeScript + Tailwind CSS. For new projects, uses shadcn/ui for components and Zustand or React state for state management.',
      tags: ['stack', 'frontend', 'tooling'],
      confidence: 'high', source: 'observed',
      createdAt: daysAgo(70), updatedAt: daysAgo(12),
      linkedIds: ['demo-skill-1'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.8,
    },

    // ── Conversations ─────────────────────────────────────────────
    {
      id: 'demo-conv-1',
      category: 'conversation',
      title: 'Mental model UI spec — session 1',
      content: 'Requested a React + shadcn/ui interface to visualise and edit the AI agent\'s knowledge base. Cited 4 HCI papers. Specified: short commits, no verbose AI footers, multi-provider support, dark Discord-like UI.',
      tags: ['product', 'design', 'hci'],
      confidence: 'high', source: 'direct',
      createdAt: daysAgo(12), updatedAt: daysAgo(12),
      linkedIds: ['demo-proj-1'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Work', importance: 0.9,
    },
    {
      id: 'demo-conv-2',
      category: 'conversation',
      title: 'Finance tracker architecture discussion',
      content: 'Discussed backend approach for the personal finance tracker. Decided on FastAPI + SQLite (no cloud DB), CSV import for bank exports, and a read-only API for the React frontend. Deploy via Docker on VPS.',
      tags: ['python', 'architecture', 'finance'],
      confidence: 'medium', source: 'direct',
      createdAt: daysAgo(40), updatedAt: daysAgo(40),
      linkedIds: ['demo-proj-2'],
      active: false, pinned: false, memoryType: 'episodic', scope: 'Side projects', importance: 0.55,
    },
  ]
}

export interface NodeFormData {
  category: NodeCategory
  title: string
  content: string
  tags: string[]
  confidence: ConfidenceLevel
  source: string
  memoryType: MemoryType
  scope: string
  importance: number
}

export function useMentalModelStore() {
  const [nodes, setNodes] = useState<MentalModelNode[]>(load)

  const mutate = useCallback((updater: (prev: MentalModelNode[]) => MentalModelNode[]) => {
    setNodes(prev => {
      const next = updater(prev)
      persist(next)
      return next
    })
  }, [])

  const addNode = useCallback((data: NodeFormData) => {
    const node: MentalModelNode = {
      id: generateId(),
      ...data,
      createdAt: now(),
      updatedAt: now(),
      linkedIds: [],
      active: true,
      pinned: false,
      position: undefined,
    }
    mutate(prev => [node, ...prev])
    return node
  }, [mutate])

  const updateNode = useCallback((id: string, data: Partial<NodeFormData>) => {
    mutate(prev => prev.map(n =>
      n.id === id ? { ...n, ...data, updatedAt: now() } : n
    ))
  }, [mutate])

  const deleteNode = useCallback((id: string) => {
    mutate(prev => prev
      .filter(n => n.id !== id)
      .map(n => ({ ...n, linkedIds: n.linkedIds.filter(lid => lid !== id) }))
    )
  }, [mutate])

  const toggleActive = useCallback((id: string) => {
    mutate(prev => prev.map(n =>
      n.id === id ? { ...n, active: !n.active, updatedAt: now() } : n
    ))
  }, [mutate])

  const togglePin = useCallback((id: string) => {
    mutate(prev => prev.map(n =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: now() } : n
    ))
  }, [mutate])

  const setPosition = useCallback((id: string, x: number, y: number) => {
    mutate(prev => prev.map(n =>
      n.id === id ? { ...n, position: { x, y } } : n
    ))
  }, [mutate])

  const linkNodes = useCallback((fromId: string, toId: string) => {
    mutate(prev => prev.map(n =>
      n.id === fromId && !n.linkedIds.includes(toId)
        ? { ...n, linkedIds: [...n.linkedIds, toId], updatedAt: now() }
        : n
    ))
  }, [mutate])

  const unlinkNodes = useCallback((fromId: string, toId: string) => {
    mutate(prev => prev.map(n =>
      n.id === fromId
        ? { ...n, linkedIds: n.linkedIds.filter(id => id !== toId), updatedAt: now() }
        : n
    ))
  }, [mutate])

  const importNodes = useCallback((newNodes: MentalModelNode[]) => {
    mutate(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const toAdd = newNodes.filter(n => !existingIds.has(n.id)).map(migrate)
      return [...toAdd, ...prev]
    })
  }, [mutate])

  const addSummaryNode = useCallback((summary: { title: string; content: string; tags: string[]; scope: string }) => {
    const node: MentalModelNode = {
      id: generateId(),
      category: 'fact',
      title: summary.title,
      content: summary.content,
      tags: summary.tags,
      confidence: 'high',
      source: 'claude-summary',
      createdAt: now(),
      updatedAt: now(),
      linkedIds: [],
      active: true,
      pinned: false,
      memoryType: 'semantic',
      scope: summary.scope,
      importance: 0.9,
    }
    mutate(prev => [node, ...prev])
    return node
  }, [mutate])

  return {
    nodes,
    addNode,
    updateNode,
    deleteNode,
    toggleActive,
    togglePin,
    setPosition,
    linkNodes,
    unlinkNodes,
    importNodes,
    addSummaryNode,
  }
}
