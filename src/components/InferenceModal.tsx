import { useState, useEffect } from 'react'
import { Loader2, Bot, Telescope, Check, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { callProvider, getDefaultProvider } from '@/lib/providers'
import { CATEGORY_COLORS, CATEGORY_DOT_COLORS, CATEGORY_LABELS, CONFIDENCE_COLORS } from '@/types/mental-model'
import type { MentalModelNode, NodeCategory, ConfidenceLevel } from '@/types/mental-model'
import { cn } from '@/lib/utils'

export type InferenceMode = 'from-selection' | 'explore-infer' | 'explore-suggest'

interface Candidate {
  title: string
  content: string
  category: NodeCategory
  confidence: ConfidenceLevel
  reasoning: string
  selected: boolean
}

interface Props {
  mode: InferenceMode
  nodes: MentalModelNode[]  // selected nodes (from-selection) or all active (explore modes)
  onAddNodes: (nodes: Array<{ title: string; content: string; category: NodeCategory; confidence: ConfidenceLevel }>) => void
  onClose: () => void
}

const MODE_CONFIG: Record<InferenceMode, { title: string; subtitle: string; system: string }> = {
  'from-selection': {
    title: 'Infer from selection',
    subtitle: 'What else might be true given these nodes?',
    system: `You are an inference engine for a personal AI knowledge graph.
Given a set of known facts about you, infer additional knowledge — facts, preferences, goals, or skills — that likely follow from what's known.
Return ONLY a JSON array (no markdown fences):
[{"title":"...","content":"...","category":"fact|preference|goal|skill|project|conversation","confidence":"high|medium|low","reasoning":"brief explanation"}]
Generate 4–6 candidates. Each must be genuinely new (not restate the input), plausible, and useful. Vary confidence levels honestly.`,
  },
  'explore-infer': {
    title: 'Infer hidden facts',
    subtitle: 'What is probably true but not yet recorded?',
    system: `You are an exploratory inference engine for a personal AI knowledge graph.
Given your full knowledge graph, identify facts, skills, preferences, or goals that are likely true but not yet explicitly recorded.
Look for patterns, gaps, and logical implications.
Return ONLY a JSON array (no markdown fences):
[{"title":"...","content":"...","category":"fact|preference|goal|skill","confidence":"high|medium|low","reasoning":"why you think this is likely true"}]
Generate 5–8 candidates. Focus on high-value inferences that would genuinely improve the knowledge graph if true.`,
  },
  'explore-suggest': {
    title: 'Suggest relevant knowledge',
    subtitle: 'What might be valuable to add or learn?',
    system: `You are a knowledge-gap advisor for a personal AI knowledge graph.
Given your existing knowledge base, suggest skills, topics, or facts that could be valuable for you to explore or add.
Think about: skills that complement your existing ones, goals aligned with your interests, knowledge gaps in your domains.
Return ONLY a JSON array (no markdown fences):
[{"title":"...","content":"...","category":"fact|preference|goal|skill","confidence":"medium|low","reasoning":"why this might be relevant"}]
Generate 5–7 suggestions. Be concrete and actionable. Mark confidence as medium/low since these are speculative.`,
  },
}

function categoryFromRaw(raw: string): NodeCategory {
  const valid: NodeCategory[] = ['project', 'conversation', 'fact', 'preference', 'goal', 'skill']
  return valid.includes(raw as NodeCategory) ? (raw as NodeCategory) : 'fact'
}
function confidenceFromRaw(raw: string): ConfidenceLevel {
  const valid: ConfidenceLevel[] = ['high', 'medium', 'low']
  return valid.includes(raw as ConfidenceLevel) ? (raw as ConfidenceLevel) : 'medium'
}

export function InferenceModal({ mode, nodes, onAddNodes, onClose }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    run()
  }, [])

  async function run() {
    setLoading(true); setError(null)
    const provider = getDefaultProvider()
    if (!provider) { setError('No AI provider configured. Add an API key in Settings.'); setLoading(false); return }

    const cfg = MODE_CONFIG[mode]
    const nodeBlock = nodes
      .slice(0, 20)
      .map(n => `- [${n.category}] ${n.title}: ${n.content}`)
      .join('\n')
    const userMsg = mode === 'from-selection'
      ? `Selected nodes:\n${nodeBlock}\n\nInfer what else might be true.`
      : `User knowledge graph:\n${nodeBlock}\n\n${mode === 'explore-suggest' ? 'Suggest relevant knowledge to add.' : 'Infer hidden facts not yet recorded.'}`

    try {
      const raw = await callProvider(provider, cfg.system, userMsg)
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned) as Array<Record<string, string>>
      setCandidates(parsed.map(c => ({
        title:      c.title ?? '',
        content:    c.content ?? '',
        category:   categoryFromRaw(c.category ?? ''),
        confidence: confidenceFromRaw(c.confidence ?? ''),
        reasoning:  c.reasoning ?? c.why_relevant ?? '',
        selected:   true,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate inferences')
    } finally {
      setLoading(false)
    }
  }

  const anySelected = candidates.some(c => c.selected)

  function toggle(i: number) {
    setCandidates(prev => prev.map((c, j) => j === i ? { ...c, selected: !c.selected } : c))
  }

  function handleAdd() {
    const toAdd = candidates.filter(c => c.selected).map(({ title, content, category, confidence }) => ({ title, content, category, confidence }))
    if (toAdd.length > 0) onAddNodes(toAdd)
    onClose()
  }

  const cfg = MODE_CONFIG[mode]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="t-ui border t-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b t-border shrink-0">
          <div className="h-8 w-8 rounded-lg t-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
            {mode === 'from-selection'
              ? <Bot className="h-4 w-4 t-accent" />
              : <Telescope className="h-4 w-4 t-accent" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold t-text">{cfg.title}</h2>
            <p className="text-xs t-muted mt-0.5">{cfg.subtitle}</p>
          </div>
          <button onClick={onClose} className="t-muted hover:t-text transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 t-muted">
              <Loader2 className="h-7 w-7 animate-spin t-accent" />
              <p className="text-sm">Generating inferences…</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-500/30 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          {!loading && !error && candidates.length === 0 && (
            <p className="text-sm t-muted text-center py-8">No inferences generated. Try adding more nodes.</p>
          )}

          {candidates.map((c, i) => (
            <div key={i}
              className={cn(
                'rounded-xl border transition-all cursor-pointer',
                c.selected ? 't-accent-border t-accent-subtle' : 't-border t-card opacity-60',
              )}
              onClick={() => toggle(i)}
            >
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                {/* Checkbox */}
                <div className={cn('h-4 w-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                  c.selected ? 't-accent-border bg-accent/20' : 't-border')}>
                  {c.selected && <Check className="h-2.5 w-2.5 t-accent" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium inline-flex items-center gap-1', CATEGORY_COLORS[c.category])}>
                      <span className={cn('text-[7px]', CATEGORY_DOT_COLORS[c.category])}>●</span>
                      {CATEGORY_LABELS[c.category]}
                    </span>
                    <span className={cn('text-[10px]', CONFIDENCE_COLORS[c.confidence])}>● {c.confidence}</span>
                    <span className="text-sm font-semibold t-text">{c.title}</span>
                  </div>
                  <p className="text-xs t-muted mt-1 leading-relaxed">{c.content}</p>
                </div>

                {/* Expand reasoning */}
                <button className="t-muted hover:t-text transition-colors shrink-0 mt-0.5"
                  onClick={e => { e.stopPropagation(); setExpandedIdx(expandedIdx === i ? null : i) }}>
                  {expandedIdx === i ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Reasoning */}
              {expandedIdx === i && c.reasoning && (
                <div className="px-3 pb-2.5 pt-0">
                  <div className="rounded-lg bg-white/4 border t-border px-3 py-2">
                    <p className="text-[11px] t-muted leading-relaxed">
                      <span className="font-semibold t-text">Reasoning: </span>{c.reasoning}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && !error && candidates.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-4 border-t t-border shrink-0">
            <p className="text-xs t-muted flex-1">
              {candidates.filter(c => c.selected).length} of {candidates.length} selected
            </p>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!anySelected}>
              Add {candidates.filter(c => c.selected).length} node{candidates.filter(c => c.selected).length !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
