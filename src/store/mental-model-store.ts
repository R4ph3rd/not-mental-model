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

function defaultNodes(): MentalModelNode[] {
  const t = now()
  return [
    {
      id: 'node-demo-1',
      category: 'project',
      title: 'Not Mental Model App',
      content: 'Building a React interface for managing the AI\'s mental model of the user. Uses shadcn/ui, Tailwind v4, and Claude API. Goal: transparent, user-controlled agent memory.',
      tags: ['react', 'typescript', 'claude', 'hci'],
      confidence: 'high',
      source: 'conversation',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-5'],
      active: true,
      pinned: true,
      memoryType: 'episodic',
      scope: 'Work',
      importance: 1.0,
    },
    {
      id: 'node-demo-2',
      category: 'preference',
      title: 'Prefers dark, minimal UIs',
      content: 'User consistently prefers dark-themed interfaces with minimal clutter and high information density. Dislikes verbose explanations in responses.',
      tags: ['ui', 'design', 'style'],
      confidence: 'high',
      source: 'observed',
      createdAt: t,
      updatedAt: t,
      linkedIds: [],
      active: true,
      pinned: false,
      memoryType: 'semantic',
      scope: 'Personal',
      importance: 0.85,
    },
    {
      id: 'node-demo-3',
      category: 'skill',
      title: 'TypeScript & React expert',
      content: 'Proficient in TypeScript and React. Comfortable with advanced patterns: custom hooks, context, render optimization, and full-stack TypeScript (Vite, Next.js).',
      tags: ['typescript', 'react', 'frontend'],
      confidence: 'high',
      source: 'conversation',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-1'],
      active: true,
      pinned: false,
      memoryType: 'semantic',
      scope: 'Skills',
      importance: 0.9,
    },
    {
      id: 'node-demo-4',
      category: 'goal',
      title: 'Build AI-native, user-controlled tools',
      content: 'Wants to create tools that expose and make AI behaviour transparent and controllable for end users. Interested in HCI research applied to AI interfaces.',
      tags: ['ai', 'product', 'hci'],
      confidence: 'medium',
      source: 'inferred',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-1'],
      active: true,
      pinned: false,
      memoryType: 'semantic',
      scope: 'Goals',
      importance: 0.75,
    },
    {
      id: 'node-demo-5',
      category: 'conversation',
      title: 'Mental model UI discussion',
      content: 'Asked for an interface to visualise and manage the AI agent\'s mental model with shadcn/ui. Cited HCI papers: Memory Sandbox (UIST \'23), CHI \'25, Regulatory Potential, Xu 2025. Wants short concise commits.',
      tags: ['product', 'design', 'hci'],
      confidence: 'high',
      source: 'direct',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-1'],
      active: true,
      pinned: false,
      memoryType: 'episodic',
      scope: 'Work',
      importance: 0.8,
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
