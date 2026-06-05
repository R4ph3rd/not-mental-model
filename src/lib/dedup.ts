import { callProvider } from '@/lib/providers'
import type { MentalModelNode } from '@/types/mental-model'

// ── Title-token similarity ────────────────────────────────────────────────────

function tokenize(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/\b\w+\b/g) ?? []).filter(w => w.length > 2))
}

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  const inter = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  return inter / union
}

// ── Match types ───────────────────────────────────────────────────────────────

export type DedupKind = 'duplicate' | 'conflict'

export interface DedupMatch {
  existing: MentalModelNode
  similarity: number   // 0–1 Jaccard on titles
  kind: DedupKind
  conflictConfirmed?: boolean  // set after LLM check
}

export interface PendingNode {
  title: string
  content: string
  category: string
  [key: string]: unknown
}

// Thresholds
const DUPLICATE_THRESHOLD = 0.65   // title similarity above this → likely same node
const CONFLICT_THRESHOLD  = 0.35   // above this but below DUPLICATE → possible conflict

export function findMatches(candidate: PendingNode, existing: MentalModelNode[]): DedupMatch[] {
  return existing
    .filter(n => n.active)
    .map(n => ({ n, sim: jaccardSimilarity(candidate.title, n.title) }))
    .filter(x => x.sim >= CONFLICT_THRESHOLD)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3)
    .map(({ n, sim }) => ({
      existing: n,
      similarity: sim,
      kind: sim >= DUPLICATE_THRESHOLD ? 'duplicate' : 'conflict',
    }))
}

// ── LLM conflict check ────────────────────────────────────────────────────────

const CONFLICT_SYSTEM = `You are a knowledge-consistency checker. Given two knowledge graph nodes, decide if they express CONTRADICTORY information about the same subject. Answer with a single word: "yes" or "no". Do not explain.`

export async function checkConflict(
  incoming: { title: string; content: string },
  existing: { title: string; content: string },
  provider: string,
): Promise<boolean> {
  const prompt =
    `Node A — "${existing.title}": ${existing.content}\n` +
    `Node B — "${incoming.title}": ${incoming.content}\n\n` +
    `Are these contradictory?`
  try {
    const result = await callProvider(provider, CONFLICT_SYSTEM, prompt)
    return result.trim().toLowerCase().startsWith('yes')
  } catch {
    return false
  }
}

// ── LLM merge ────────────────────────────────────────────────────────────────

const MERGE_SYSTEM = `You are a knowledge consolidation assistant. Merge two related knowledge graph nodes into a single, accurate, concise node. Return ONLY a JSON object with no markdown fences: {"title": "...", "content": "..."}`

export async function mergeNodes(
  a: { title: string; content: string },
  b: { title: string; content: string },
  provider: string,
): Promise<{ title: string; content: string } | null> {
  const prompt = `Node A — "${a.title}": ${a.content}\nNode B — "${b.title}": ${b.content}`
  try {
    const raw     = await callProvider(provider, MERGE_SYSTEM, prompt)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    if (typeof parsed.title === 'string' && typeof parsed.content === 'string') return parsed
  } catch { /* fall through */ }
  return null
}

// ── Batch classify ────────────────────────────────────────────────────────────

export interface ClassifiedNode {
  node: PendingNode
  matches: DedupMatch[]
}

export function classifyIncoming(
  incoming: PendingNode[],
  existing: MentalModelNode[],
): { needsReview: ClassifiedNode[]; clean: PendingNode[] } {
  const needsReview: ClassifiedNode[] = []
  const clean: PendingNode[] = []

  for (const node of incoming) {
    const matches = findMatches(node, existing)
    if (matches.length > 0) needsReview.push({ node, matches })
    else clean.push(node)
  }
  return { needsReview, clean }
}
