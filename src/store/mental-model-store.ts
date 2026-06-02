import { useState, useCallback } from 'react'
import type {
  MentalModelNode, NodeCategory, ConfidenceLevel, MemoryType,
  Project, Conversation, MemoryGroup, Provenance,
} from '@/types/mental-model'

const NODES_KEY    = 'mental-model-nodes'
const PROJECTS_KEY = 'mm-projects'
const CONVS_KEY    = 'mm-conversations'
const GROUPS_KEY   = 'mm-groups'

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function now() { return new Date().toISOString() }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString() }

// ── Demo data: Jordan, design engineer ─────────────────────────────────────

const DEMO_PROJECTS: Project[] = [
  { id: 'dp-work',     name: 'Work',     color: 'hsl(235 70% 62%)', createdAt: daysAgo(90) },
  { id: 'dp-personal', name: 'Personal', color: 'hsl(330 70% 60%)', createdAt: daysAgo(90) },
  { id: 'dp-learning', name: 'Learning', color: 'hsl(142 60% 45%)', createdAt: daysAgo(60) },
]

const DEMO_CONVS: Conversation[] = [
  { id: 'dc-sprint',  projectId: 'dp-work',     title: 'Sprint retro — end of Q4',               source: 'claude.ai', createdAt: daysAgo(17) },
  { id: 'dc-ds',      projectId: 'dp-work',     title: 'Design system: button variants',          source: 'claude.ai', createdAt: daysAgo(4)  },
  { id: 'dc-palette', projectId: 'dp-personal', title: 'Palette app — color token scoping',       source: 'claude.ai', createdAt: daysAgo(12) },
  { id: 'dc-morning', projectId: 'dp-personal', title: 'Morning routine experiment',              source: 'chatgpt',   createdAt: daysAgo(22) },
  { id: 'dc-rust',    projectId: 'dp-learning', title: 'Rust: ownership + lifetimes walkthrough', source: 'claude.ai', createdAt: daysAgo(7)  },
]

const DEMO_GROUPS: MemoryGroup[] = []

function defaultNodes(): MentalModelNode[] {
  return [
    // ── Skills ────────────────────────────────────────────────────
    {
      id: 'dn-skill-figma', category: 'skill', title: 'Figma — expert',
      content: 'Uses Figma as primary design tool. Deep experience with component libraries, auto-layout, variables, and design tokens. Runs the design-system file at work single-handedly.',
      tags: ['figma', 'design', 'design-system'], confidence: 'high', source: 'observed',
      createdAt: daysAgo(60), updatedAt: daysAgo(5), linkedIds: ['dn-proj-ds'],
      active: true, pinned: true, memoryType: 'semantic', scope: 'Skills', importance: 0.95,
      projectId: 'dp-work', conversationIds: ['dc-ds'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-skill-react', category: 'skill', title: 'React + TypeScript — proficient',
      content: 'Four years of React. Comfortable with hooks, context, custom hooks, and component composition. Prefers functional components. Uses Vite for builds.',
      tags: ['react', 'typescript', 'frontend'], confidence: 'high', source: 'observed',
      createdAt: daysAgo(80), updatedAt: daysAgo(10), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.9,
      projectId: 'dp-work', conversationIds: [],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-skill-framer', category: 'skill', title: 'Framer Motion — intermediate',
      content: 'Comfortable with Framer Motion for micro-interactions. Believes most animations should be under 200ms and purposeful. Dislikes flashy scroll-triggered effects.',
      tags: ['animation', 'framer-motion'], confidence: 'medium', source: 'conversation',
      createdAt: daysAgo(45), updatedAt: daysAgo(30), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Skills', importance: 0.6,
      projectId: 'dp-work', conversationIds: [],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-skill-rust', category: 'skill', title: 'Rust — beginner',
      content: 'Actively learning Rust. On chapter 10 of "The Rust Programming Language" book. Finds the ownership model counterintuitive but compelling. Goal: write a real CLI tool before switching to another language.',
      tags: ['rust', 'systems', 'learning'], confidence: 'low', source: 'conversation',
      createdAt: daysAgo(14), updatedAt: daysAgo(7), linkedIds: ['dn-goal-rust'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Learning', importance: 0.7,
      projectId: 'dp-learning', conversationIds: ['dc-rust'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },

    // ── Preferences ───────────────────────────────────────────────
    {
      id: 'dn-pref-figmafirst', category: 'preference', title: 'Figma-first for visual features',
      content: 'Never writes UI code without a Figma mock first for anything user-facing. Finds it faster to iterate in Figma than push pixels in code.',
      tags: ['figma', 'workflow', 'design'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(50), updatedAt: daysAgo(4), linkedIds: ['dn-skill-figma'],
      active: true, pinned: true, memoryType: 'semantic', scope: 'Personal', importance: 0.95,
      projectId: 'dp-work', conversationIds: ['dc-ds'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-pref-darkmode', category: 'preference', title: 'Dark mode always',
      content: 'Uses dark mode on every device, app, and website. Finds light mode physically uncomfortable for extended work.',
      tags: ['ui', 'dark-mode'], confidence: 'high', source: 'observed',
      createdAt: daysAgo(90), updatedAt: daysAgo(90), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.85,
      projectId: undefined, conversationIds: [],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-pref-nomeetings', category: 'preference', title: 'No meetings before 10am',
      content: 'Protects mornings for deep work. Has a standing agreement with their team to block calendars before 10am CET.',
      tags: ['async', 'focus', 'work-style'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(40), updatedAt: daysAgo(17), linkedIds: [],
      active: true, pinned: true, memoryType: 'semantic', scope: 'Work', importance: 0.9,
      projectId: 'dp-work', conversationIds: ['dc-sprint'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-pref-espresso', category: 'preference', title: 'Espresso, not drip coffee',
      content: 'Drinks espresso exclusively, always first thing in the morning. Grinds their own beans (currently a Kenyan natural from a Lisbon roaster).',
      tags: ['coffee', 'morning', 'routine'], confidence: 'high', source: 'conversation',
      createdAt: daysAgo(22), updatedAt: daysAgo(22), linkedIds: ['dn-fact-morning'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.6,
      projectId: 'dp-personal', conversationIds: ['dc-morning'],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    },

    // ── Goals ─────────────────────────────────────────────────────
    {
      id: 'dn-goal-palette', category: 'goal', title: 'Ship Palette v1 by summer',
      content: 'Palette is a side project: a browser-based color token generator. MVP is 80% done. Blockers: token naming convention UI and export format selector.',
      tags: ['palette', 'side-project', 'design-tokens'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(20), updatedAt: daysAgo(12), linkedIds: ['dn-proj-palette'],
      active: true, pinned: true, memoryType: 'episodic', scope: 'Personal', importance: 1.0,
      projectId: 'dp-personal', conversationIds: ['dc-palette'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-goal-rust', category: 'goal', title: 'Write a real CLI tool in Rust',
      content: 'Wants to finish the Rust book and write a small but actually useful CLI tool (idea: a local file-tagging system). Wants to be "Rust-literate" by end of Q2.',
      tags: ['rust', 'cli', 'learning-goal'], confidence: 'medium', source: 'conversation',
      createdAt: daysAgo(14), updatedAt: daysAgo(7), linkedIds: ['dn-skill-rust'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Learning', importance: 0.75,
      projectId: 'dp-learning', conversationIds: ['dc-rust'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },

    // ── Facts ─────────────────────────────────────────────────────
    {
      id: 'dn-fact-location', category: 'fact', title: 'Lisbon, Portugal — GMT+1',
      content: 'Lives and works in Lisbon. Timezone is WET/WEST (GMT+1/+2). Moved from Lyon 4 years ago.',
      tags: ['location', 'timezone', 'lisbon'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(100), updatedAt: daysAgo(100), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.9,
      projectId: undefined, conversationIds: [],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-fact-work', category: 'fact', title: 'Remote design engineer at a dev-tools startup',
      content: 'Works at a ~20-person company building CI/CD tooling. Only designer on the team. Has been fully remote for 3 years.',
      tags: ['work', 'remote', 'startup'], confidence: 'high', source: 'conversation',
      createdAt: daysAgo(80), updatedAt: daysAgo(17), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Work', importance: 0.85,
      projectId: 'dp-work', conversationIds: ['dc-sprint'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-fact-pets', category: 'fact', title: 'Dog Pesto + cat Miso',
      content: 'Has a chocolate Labrador named Pesto and a tabby cat named Miso. Pesto is 2 years old.',
      tags: ['pets', 'personal'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(50), updatedAt: daysAgo(22), linkedIds: [],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.6,
      projectId: 'dp-personal', conversationIds: ['dc-morning'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-fact-morning', category: 'fact', title: 'Morning routine: espresso → sketch → Pesto walk',
      content: '7am: espresso. 7:15–7:45: 30min freehand sketching in a Field Notes notebook. 8am: walk Pesto 25min. Work starts 9am.',
      tags: ['morning', 'routine', 'sketch'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(22), updatedAt: daysAgo(22), linkedIds: ['dn-fact-pets', 'dn-pref-espresso'],
      active: true, pinned: true, memoryType: 'episodic', scope: 'Personal', importance: 0.7,
      projectId: 'dp-personal', conversationIds: ['dc-morning'],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-fact-games', category: 'fact', title: 'Games: Hollow Knight, Celeste, Stardew',
      content: 'Completed Hollow Knight at 112%. Working through Celeste B-sides. Plays Stardew Valley co-op with partner Maë.',
      tags: ['games', 'hobby'], confidence: 'high', source: 'conversation',
      createdAt: daysAgo(35), updatedAt: daysAgo(35), linkedIds: [],
      active: false, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.45,
      projectId: undefined, conversationIds: [],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },

    // ── Projects ──────────────────────────────────────────────────
    {
      id: 'dn-proj-palette', category: 'project', title: 'Palette — color token generator',
      content: 'Browser-based tool that takes a base color and generates a full token scale with OKLCH, CSS custom properties, Tailwind config, and Figma token JSON exports.',
      tags: ['palette', 'color', 'design-tokens'], confidence: 'high', source: 'direct',
      createdAt: daysAgo(45), updatedAt: daysAgo(12), linkedIds: ['dn-goal-palette', 'dn-skill-react'],
      active: true, pinned: true, memoryType: 'episodic', scope: 'Personal', importance: 0.95,
      projectId: 'dp-personal', conversationIds: ['dc-palette'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-proj-ds', category: 'project', title: 'Work design system — button refactor',
      content: 'Refactoring the Button component to support 4 variants × 3 sizes × loading state, using Figma variables synced via Tokens Studio.',
      tags: ['design-system', 'figma', 'tokens'], confidence: 'high', source: 'conversation',
      createdAt: daysAgo(10), updatedAt: daysAgo(4), linkedIds: ['dn-skill-figma', 'dn-skill-react'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Work', importance: 0.8,
      projectId: 'dp-work', conversationIds: ['dc-ds'],
      groupIds: [], provenance: 'user', confirmed: true, sensitive: false,
    },

    // ── Conversations ─────────────────────────────────────────────
    {
      id: 'dn-conv-sprint', category: 'conversation', title: 'Sprint retro — end of Q4',
      content: 'Wins: shipped dashboard redesign, unblocked engineers on design handoff. Improvement: unclear acceptance criteria delayed onboarding flow. Action: write design specs before each sprint.',
      tags: ['work', 'sprint', 'retro'], confidence: 'high', source: 'claude.ai',
      createdAt: daysAgo(17), updatedAt: daysAgo(17), linkedIds: ['dn-fact-work'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Work', importance: 0.65,
      projectId: 'dp-work', conversationIds: ['dc-sprint'],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    },
    {
      id: 'dn-conv-rust', category: 'conversation', title: 'Rust ownership deep dive',
      content: 'Worked through chapters 4 and 10 of the Rust book. Key insight: lifetime annotations clarify intent. Still confused about `\'static` lifetime in trait objects.',
      tags: ['rust', 'learning', 'ownership'], confidence: 'medium', source: 'claude.ai',
      createdAt: daysAgo(7), updatedAt: daysAgo(7), linkedIds: ['dn-skill-rust', 'dn-goal-rust'],
      active: true, pinned: false, memoryType: 'episodic', scope: 'Learning', importance: 0.7,
      projectId: 'dp-learning', conversationIds: ['dc-rust'],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    },
    // ── Agent-inferred (unconfirmed) — shows the governance provenance feature ──
    {
      id: 'dn-agent-1', category: 'preference', title: 'Prefers OKLCH over HSL for color work',
      content: 'Based on conversation context, seems to strongly prefer OKLCH color space for design token generation — mentioned it unprompted when discussing Palette\'s export formats.',
      tags: ['color', 'design-tokens', 'palette'], confidence: 'medium', source: 'chat-auto',
      createdAt: daysAgo(3), updatedAt: daysAgo(3), linkedIds: ['dn-proj-palette'],
      active: true, pinned: false, memoryType: 'semantic', scope: 'Personal', importance: 0.6,
      projectId: 'dp-personal', conversationIds: ['dc-palette'],
      groupIds: [], provenance: 'agent', confirmed: false, sensitive: false,
    },
  ]
}

// ── Persistence helpers ────────────────────────────────────────────────────

function migrateNode(raw: Partial<MentalModelNode> & { conversationId?: string }): MentalModelNode {
  return {
    id: raw.id ?? uid(),
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
    projectId: raw.projectId,
    // migrate legacy single conversationId
    conversationIds: raw.conversationIds ?? (raw.conversationId ? [raw.conversationId] : []),
    groupIds: raw.groupIds ?? [],
    provenance: raw.provenance ?? 'user',
    confirmed: raw.confirmed ?? true,
    sensitive: raw.sensitive ?? false,
  }
}

function loadNodes(): MentalModelNode[] {
  try {
    const raw = localStorage.getItem(NODES_KEY)
    if (!raw) return defaultNodes()
    return (JSON.parse(raw) as Array<Partial<MentalModelNode> & { conversationId?: string }>).map(migrateNode)
  } catch { return defaultNodes() }
}
function persistNodes(n: MentalModelNode[]) { localStorage.setItem(NODES_KEY, JSON.stringify(n)) }

function loadProjects(): Project[] {
  try { const r = localStorage.getItem(PROJECTS_KEY); return r ? JSON.parse(r) : DEMO_PROJECTS }
  catch { return DEMO_PROJECTS }
}
function persistProjects(p: Project[]) { localStorage.setItem(PROJECTS_KEY, JSON.stringify(p)) }

function loadConversations(): Conversation[] {
  try { const r = localStorage.getItem(CONVS_KEY); return r ? JSON.parse(r) : DEMO_CONVS }
  catch { return DEMO_CONVS }
}
function persistConversations(c: Conversation[]) { localStorage.setItem(CONVS_KEY, JSON.stringify(c)) }

function loadGroups(): MemoryGroup[] {
  try { const r = localStorage.getItem(GROUPS_KEY); return r ? JSON.parse(r) : DEMO_GROUPS }
  catch { return DEMO_GROUPS }
}
function persistGroups(g: MemoryGroup[]) { localStorage.setItem(GROUPS_KEY, JSON.stringify(g)) }

// ── Store hook ─────────────────────────────────────────────────────────────

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
  provenance?: Provenance
  confirmed?: boolean
  sensitive?: boolean
  groupIds?: string[]
}

export function useMentalModelStore() {
  const [nodes, setNodes]                   = useState<MentalModelNode[]>(loadNodes)
  const [projects, setProjects]             = useState<Project[]>(loadProjects)
  const [conversations, setConversations]   = useState<Conversation[]>(loadConversations)
  const [groups, setGroups]                 = useState<MemoryGroup[]>(loadGroups)

  // ── Nodes ────────────────────────────────────────────────────────

  const mutateNodes = useCallback((fn: (prev: MentalModelNode[]) => MentalModelNode[]) => {
    setNodes(prev => { const next = fn(prev); persistNodes(next); return next })
  }, [])

  const addNode = useCallback((
    data: NodeFormData,
    projectId?: string,
    conversationIds?: string[],
  ) => {
    const node: MentalModelNode = {
      id: uid(),
      ...data,
      provenance: data.provenance ?? 'user',
      confirmed: data.confirmed ?? true,
      sensitive: data.sensitive ?? false,
      groupIds: data.groupIds ?? [],
      createdAt: now(), updatedAt: now(),
      linkedIds: [], active: true, pinned: false,
      position: undefined,
      projectId,
      conversationIds: conversationIds ?? [],
    }
    mutateNodes(prev => [node, ...prev])
    return node
  }, [mutateNodes])

  const updateNode = useCallback((id: string, data: Partial<NodeFormData> & { conversationIds?: string[] }) => {
    mutateNodes(prev => prev.map(n => n.id === id ? { ...n, ...data, updatedAt: now() } : n))
  }, [mutateNodes])

  const deleteNode = useCallback((id: string) => {
    mutateNodes(prev => prev
      .filter(n => n.id !== id)
      .map(n => ({ ...n, linkedIds: n.linkedIds.filter(lid => lid !== id) }))
    )
  }, [mutateNodes])

  const toggleActive = useCallback((id: string) => {
    mutateNodes(prev => prev.map(n => n.id === id ? { ...n, active: !n.active, updatedAt: now() } : n))
  }, [mutateNodes])

  const togglePin = useCallback((id: string) => {
    mutateNodes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: now() } : n))
  }, [mutateNodes])

  const confirmNode = useCallback((id: string) => {
    mutateNodes(prev => prev.map(n => n.id === id ? { ...n, confirmed: true, updatedAt: now() } : n))
  }, [mutateNodes])

  const setPosition = useCallback((id: string, x: number, y: number) => {
    mutateNodes(prev => prev.map(n => n.id === id ? { ...n, position: { x, y } } : n))
  }, [mutateNodes])

  const linkNodes = useCallback((fromId: string, toId: string) => {
    mutateNodes(prev => prev.map(n =>
      n.id === fromId && !n.linkedIds.includes(toId)
        ? { ...n, linkedIds: [...n.linkedIds, toId], updatedAt: now() } : n
    ))
  }, [mutateNodes])

  const unlinkNodes = useCallback((fromId: string, toId: string) => {
    mutateNodes(prev => prev.map(n =>
      n.id === fromId ? { ...n, linkedIds: n.linkedIds.filter(id => id !== toId), updatedAt: now() } : n
    ))
  }, [mutateNodes])

  // stamp provenance: 'extracted' on imported nodes that don't already have it
  const importNodes = useCallback((newNodes: MentalModelNode[]) => {
    mutateNodes(prev => {
      const existingIds = new Set(prev.map(n => n.id))
      const toAdd = newNodes
        .filter(n => !existingIds.has(n.id))
        .map(n => migrateNode({ ...n, provenance: n.provenance ?? 'extracted', confirmed: true }))
      return [...toAdd, ...prev]
    })
  }, [mutateNodes])

  const addSummaryNode = useCallback((summary: { title: string; content: string; tags: string[]; scope: string }) => {
    const node: MentalModelNode = {
      id: uid(), category: 'fact',
      title: summary.title, content: summary.content, tags: summary.tags,
      confidence: 'high', source: 'claude-summary',
      createdAt: now(), updatedAt: now(),
      linkedIds: [], active: true, pinned: false,
      memoryType: 'semantic', scope: summary.scope, importance: 0.9,
      projectId: undefined, conversationIds: [],
      groupIds: [], provenance: 'extracted', confirmed: true, sensitive: false,
    }
    mutateNodes(prev => [node, ...prev])
    return node
  }, [mutateNodes])

  // ── Projects ─────────────────────────────────────────────────────

  const mutateProjects = useCallback((fn: (prev: Project[]) => Project[]) => {
    setProjects(prev => { const next = fn(prev); persistProjects(next); return next })
  }, [])

  const addProject = useCallback((name: string, color: string) => {
    const p: Project = { id: `p-${uid()}`, name, color, createdAt: now() }
    mutateProjects(prev => [...prev, p])
    return p
  }, [mutateProjects])

  const updateProject = useCallback((id: string, data: Partial<Pick<Project, 'name' | 'color'>>) => {
    mutateProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [mutateProjects])

  const deleteProject = useCallback((id: string) => {
    mutateProjects(prev => prev.filter(p => p.id !== id))
    setConversations(prev => { const next = prev.filter(c => c.projectId !== id); persistConversations(next); return next })
    mutateNodes(prev => prev.map(n => n.projectId === id ? { ...n, projectId: undefined, conversationIds: [] } : n))
  }, [mutateProjects, mutateNodes])

  // ── Conversations ────────────────────────────────────────────────

  const mutateConvs = useCallback((fn: (prev: Conversation[]) => Conversation[]) => {
    setConversations(prev => { const next = fn(prev); persistConversations(next); return next })
  }, [])

  const addConversation = useCallback((projectId: string, title: string, source?: string) => {
    const c: Conversation = { id: `c-${uid()}`, projectId, title, source, createdAt: now() }
    mutateConvs(prev => [...prev, c])
    return c
  }, [mutateConvs])

  const deleteConversation = useCallback((id: string) => {
    mutateConvs(prev => prev.filter(c => c.id !== id))
    mutateNodes(prev => prev.map(n => ({
      ...n,
      conversationIds: n.conversationIds.filter(cid => cid !== id),
    })))
  }, [mutateConvs, mutateNodes])

  // ── Groups ───────────────────────────────────────────────────────

  const mutateGroups = useCallback((fn: (prev: MemoryGroup[]) => MemoryGroup[]) => {
    setGroups(prev => { const next = fn(prev); persistGroups(next); return next })
  }, [])

  const addGroup = useCallback((name: string, color: string, parentId?: string) => {
    const g: MemoryGroup = { id: `g-${uid()}`, name, color, active: true, parentId, createdAt: now() }
    mutateGroups(prev => [...prev, g])
    return g
  }, [mutateGroups])

  const updateGroup = useCallback((id: string, data: Partial<Pick<MemoryGroup, 'name' | 'color' | 'parentId' | 'active'>>) => {
    mutateGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
  }, [mutateGroups])

  const deleteGroup = useCallback((id: string) => {
    mutateGroups(prev => prev.filter(g => g.id !== id))
    mutateNodes(prev => prev.map(n => ({ ...n, groupIds: n.groupIds.filter(gid => gid !== id) })))
  }, [mutateGroups, mutateNodes])

  const toggleGroupActive = useCallback((id: string) => {
    mutateGroups(prev => prev.map(g => g.id === id ? { ...g, active: !g.active } : g))
  }, [mutateGroups])

  return {
    nodes, addNode, updateNode, deleteNode,
    toggleActive, togglePin, confirmNode, setPosition,
    linkNodes, unlinkNodes, importNodes, addSummaryNode,
    projects, addProject, updateProject, deleteProject,
    conversations, addConversation, deleteConversation,
    groups, addGroup, updateGroup, deleteGroup, toggleGroupActive,
  }
}
