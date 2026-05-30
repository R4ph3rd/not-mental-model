import { useState, useCallback } from 'react'
import type { MentalModelNode, NodeCategory, ConfidenceLevel } from '@/types/mental-model'

const STORAGE_KEY = 'mental-model-nodes'

function generateId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function now() {
  return new Date().toISOString()
}

function load(): MentalModelNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : defaultNodes()
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
      content: 'Building a React interface for managing the AI\'s mental model of the user. Uses shadcn/ui, Tailwind, and Claude API.',
      tags: ['react', 'typescript', 'claude'],
      confidence: 'high',
      source: 'conversation',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-2'],
    },
    {
      id: 'node-demo-2',
      category: 'preference',
      title: 'Prefers dark UI',
      content: 'User consistently prefers dark-themed interfaces with minimal clutter.',
      tags: ['ui', 'design'],
      confidence: 'high',
      source: 'observed',
      createdAt: t,
      updatedAt: t,
      linkedIds: [],
    },
    {
      id: 'node-demo-3',
      category: 'skill',
      title: 'TypeScript & React',
      content: 'Proficient in TypeScript and React. Comfortable with advanced patterns like custom hooks, context, and state management.',
      tags: ['typescript', 'react', 'frontend'],
      confidence: 'high',
      source: 'conversation',
      createdAt: t,
      updatedAt: t,
      linkedIds: [],
    },
    {
      id: 'node-demo-4',
      category: 'goal',
      title: 'Build AI-native tools',
      content: 'Wants to create tools that expose and make AI behaviour transparent and controllable for end users.',
      tags: ['ai', 'product'],
      confidence: 'medium',
      source: 'inferred',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-1'],
    },
    {
      id: 'node-demo-5',
      category: 'conversation',
      title: 'Mental model UI discussion',
      content: 'Asked for an interface to view/manage the AI agent\'s mental model with shadcn/ui components. Wants CRUD, Claude integration, and meaningful commits.',
      tags: ['product', 'design'],
      confidence: 'high',
      source: 'direct',
      createdAt: t,
      updatedAt: t,
      linkedIds: ['node-demo-1'],
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

  const importFromClaude = useCallback((newNodes: MentalModelNode[]) => {
    mutate(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const toAdd = newNodes.filter(n => !existingIds.has(n.id))
      return [...toAdd, ...prev]
    })
  }, [mutate])

  return { nodes, addNode, updateNode, deleteNode, linkNodes, unlinkNodes, importFromClaude }
}
