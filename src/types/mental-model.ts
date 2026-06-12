export type NodeCategory = 'project' | 'conversation' | 'fact' | 'preference' | 'goal' | 'skill'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type MemoryType = 'episodic' | 'semantic'
export type Provenance = 'user' | 'agent' | 'extracted'

export interface Project {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Conversation {
  id: string
  projectId?: string   // optional — conversations can live at root
  title: string
  source?: string
  createdAt: string
}

// Jones CHI 2025: user-defined groups orthogonal to project hierarchy
export interface MemoryGroup {
  id: string
  name: string
  color: string
  active: boolean  // when false, all members are excluded from agent context
  parentId?: string  // optional parent project/group id for nesting
  createdAt: string
}

export interface MentalModelNode {
  id: string
  category: NodeCategory
  title: string
  content: string
  tags: string[]
  confidence: ConfidenceLevel
  source?: string
  createdAt: string
  updatedAt: string
  linkedIds: string[]
  // Memory Sandbox (UIST 2023): toggle agent visibility
  active: boolean
  // Xu 2025: user pin to retain against decay
  pinned: boolean
  // Xu 2025: episodic = specific event/conversation, semantic = abstracted fact
  memoryType: MemoryType
  // CHI 2025: user-defined project/domain scope
  scope: string
  // Xu 2025: 0–1 user-specified utility weight
  importance: number
  // Canvas spatial layout
  position?: { x: number; y: number }
  // Project/conversation hierarchy; a node can live in multiple conversations (Memory Sandbox cross-sharing)
  projectId?: string
  conversationIds: string[]
  // Jones CHI 2025: user-defined groups
  groupIds: string[]
  // Governance paper: who created this memory
  provenance: Provenance
  // Governance paper: agent-inferred memories require user confirmation
  confirmed: boolean
  // Governance paper: exclude from copy-context and chat context
  sensitive: boolean
  // mem0 cloud memory ID — set after successful sync, used for updates/deletes
  mem0Id?: string
  // Per-node sync status so the UI can surface failures
  mem0SyncState?: 'pending' | 'synced' | 'error'
  // Bumped whenever this node is surfaced in chat recall — feeds decay recency
  lastAccessedAt?: string
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  project: 'Project',
  conversation: 'Conversation',
  fact: 'Fact',
  preference: 'Preference',
  goal: 'Goal',
  skill: 'Skill',
}

/**
 * Card / chip surface per category. Deliberately uniform and neutral
 * (Clerk/Linear-style): hue is reserved for the small CATEGORY_DOT_COLORS
 * marker so the UI stays quiet while categories remain scannable.
 */
export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  project:      'cat-bar',
  conversation: 'cat-bar',
  fact:         'cat-bar',
  preference:   'cat-bar',
  goal:         'cat-bar',
  skill:        'cat-bar',
}

/** Tiny ink area only — icon / dot color that identifies the category. */
export const CATEGORY_DOT_COLORS: Record<NodeCategory, string> = {
  project:      'text-sky-400',
  conversation: 'text-violet-400',
  fact:         'text-teal-400',
  preference:   'text-amber-400',
  goal:         'text-rose-400',
  skill:        'text-cyan-400',
}

/**
 * Confidence = data intensity, expressed as shades of the accent blue
 * (dense → light → near-white) instead of traffic-light hues.
 * Classes defined in styles/tokens.css, theme-aware.
 */
export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high:   'conf-high',
  medium: 'conf-medium',
  low:    'conf-low',
}

/**
 * Full portable backup produced by "Backup" and consumed by "Restore".
 *
 * The four collections are independent flat arrays of ID-keyed objects.
 * All hierarchy is encoded as ID references on the entities themselves:
 *   - node.projectId          → optional Project
 *   - node.conversationIds[]  → zero or more Conversations (no project required)
 *   - node.groupIds[]         → zero or more MemoryGroups (any nesting depth)
 *   - node.linkedIds[]        → peer nodes (graph edges)
 *   - conversation.projectId  → optional Project
 *   - group.parentId          → optional parent Group or Project (arbitrary depth)
 *
 * A valid backup may have any subset of these populated — including all four
 * empty (a blank graph), or only nodes with no hierarchy at all.
 */
export interface GraphBackup {
  schemaVersion: 1
  exportedAt: string
  nodes:         MentalModelNode[]
  projects:      Project[]
  conversations: Conversation[]
  groups:        MemoryGroup[]
}
