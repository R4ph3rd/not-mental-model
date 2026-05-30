export type NodeCategory = 'project' | 'conversation' | 'fact' | 'preference' | 'goal' | 'skill'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

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
}

export interface MentalModelStore {
  nodes: MentalModelNode[]
  lastSyncedAt: string | null
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  project: 'Project',
  conversation: 'Conversation',
  fact: 'Fact',
  preference: 'Preference',
  goal: 'Goal',
  skill: 'Skill',
}

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  project: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  conversation: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  fact: 'bg-green-500/15 text-green-300 border-green-500/30',
  preference: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  goal: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  skill: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
}

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-red-400',
}
