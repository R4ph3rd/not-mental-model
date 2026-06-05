import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader2, Brain, Zap, AlertCircle, PauseCircle, PlayCircle, Bot, SquarePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PROVIDER_CONFIGS, callProvider, getDefaultProvider } from '@/lib/providers'
import { getMem0Config, mem0Search, mem0Add, type Mem0Memory } from '@/lib/mem0'
import { cn } from '@/lib/utils'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryGroup } from '@/types/mental-model'

interface RecalledMemory {
  text: string
  nodeId?: string
  nodeTitle?: string
  score?: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  recalledMemories?: RecalledMemory[]
  newNodeCount?: number
}

interface Props {
  nodes: MentalModelNode[]
  groups: MemoryGroup[]
  onAgentNodes: (nodes: Array<{
    title: string; content: string; category: NodeCategory; confidence: ConfidenceLevel
  }>) => void
  onBumpAccess?: (ids: string[]) => void
  onClose: () => void
}

// Two-layer context: base (primed on open) + per-message recalled
const CHAT_SYSTEM = (primed: string, recalled: string) =>
  `You are a helpful AI assistant with access to the user's personal knowledge graph.
${primed ? `\nBackground knowledge about the user:\n${primed}\n` : ''}${recalled ? `\nContext specifically relevant to this question:\n${recalled}\n` : ''}
Use these facts naturally in your responses. Be helpful, direct, and concise.`

const EXTRACT_SYSTEM = `Extract key new persistent facts about the user from this conversation exchange.
Return ONLY a compact JSON array (no markdown fences): [{title, content, category, confidence, memoryType}]
- category: "fact"|"preference"|"goal"|"skill"|"project"|"conversation"
- confidence: "high"|"medium"|"low"
- memoryType: "semantic"|"episodic"
Extract only genuinely new, lasting information. Max 3 items. If nothing memorable, return [].`

// How many memories to pull as base context on discussion open
const PRIME_LIMIT = 12
// How many to search per message
const RECALL_LIMIT = 6

export function ChatPanel({ nodes, groups, onAgentNodes, onBumpAccess, onClose }: Props) {
  const [provider, setProvider] = useState(getDefaultProvider)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoPaused, setMemoPaused] = useState(false)

  // Primed context — loaded on discussion open from mem0 or local graph
  const [primedMemories, setPrimedMemories] = useState<RecalledMemory[]>([])
  const [primingState, setPrimingState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const bottomRef = useRef<HTMLDivElement>(null)
  const mem0 = getMem0Config()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Prime context when discussion opens ──────────────────────────────────
  const primeContext = useCallback(async () => {
    setPrimingState('loading')
    try {
      let primed: RecalledMemory[] = []

      if (mem0) {
        // Fetch double the limit so importance re-ranking has candidates to sort
        const found = await mem0Search(
          mem0.apiKey, mem0.userId,
          'user background knowledge preferences goals skills projects',
          PRIME_LIMIT * 2,
        )
        // Re-rank: blend mem0 semantic score (60%) with stored importance (40%)
        const ranked = found
          .map(m => {
            const node = nodes.find(n =>
              n.title.toLowerCase().includes(m.memory.slice(0, 20).toLowerCase()) ||
              m.memory.toLowerCase().includes(n.title.toLowerCase())
            )
            const importance = (m.metadata?.importance as number | undefined) ?? node?.importance ?? 0.5
            const combined = (m.score ?? 0.5) * 0.6 + importance * 0.4
            return { m, node, combined }
          })
          .sort((a, b) => b.combined - a.combined)
          .slice(0, PRIME_LIMIT)
        primed = ranked.map(({ m, node }) => ({
          text: m.memory,
          nodeId: node?.id,
          nodeTitle: node?.title,
          score: m.score,
        }))
      } else {
        // Fallback: top active non-sensitive nodes sorted by importance
        const inactiveGroups = new Set(groups.filter(g => !g.active).map(g => g.id))
        primed = nodes
          .filter(n => n.active && !n.sensitive && !n.groupIds.some(gid => inactiveGroups.has(gid)))
          .sort((a, b) => b.importance - a.importance)
          .slice(0, PRIME_LIMIT)
          .map(n => ({ text: `${n.title}: ${n.content}`, nodeId: n.id, nodeTitle: n.title }))
      }

      setPrimedMemories(primed)
      setPrimingState('done')
    } catch {
      setPrimingState('error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void primeContext()
  }, [primeContext])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function matchToNodes(found: Mem0Memory[]): RecalledMemory[] {
    return found.map(m => {
      const match = nodes.find(n =>
        n.title.toLowerCase().includes(m.memory.slice(0, 20).toLowerCase()) ||
        m.memory.toLowerCase().includes(n.title.toLowerCase())
      )
      return {
        text: m.memory,
        nodeId: match?.id,
        nodeTitle: match?.title,
        score: m.score,
      }
    })
  }

  function formatMemories(mems: RecalledMemory[]): string {
    return mems.map(m => `• ${m.text}`).join('\n')
  }

  // ── New discussion ────────────────────────────────────────────────────────
  async function newDiscussion() {
    setMessages([])
    setInput('')
    setError(null)
    setPrimedMemories([])
    await primeContext()
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // 1. Recall memories semantically relevant to THIS message
      let recalledMemories: RecalledMemory[] = []
      if (mem0 && !memoPaused) {
        const found = await mem0Search(mem0.apiKey, mem0.userId, text, RECALL_LIMIT)
        recalledMemories = matchToNodes(found)
        // Bump lastAccessedAt so decay recency reflects actual usage
        const accessedIds = recalledMemories.flatMap(m => m.nodeId ? [m.nodeId] : [])
        if (accessedIds.length) onBumpAccess?.(accessedIds)
      }

      const primedBlock  = primedMemories.length ? formatMemories(primedMemories)  : ''
      const recalledBlock = recalledMemories.length ? formatMemories(recalledMemories) : ''

      // 2. Build conversation history
      const history   = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      const userTurn  = history ? `${history}\n\nUser: ${text}` : text

      // 3. Call LLM with layered context
      const reply = await callProvider(provider, CHAT_SYSTEM(primedBlock, recalledBlock), userTurn)

      // 4. Save exchange to mem0 (unless paused)
      if (mem0 && !memoPaused) {
        void mem0Add(mem0.apiKey, mem0.userId, [
          { role: 'user',      content: text  },
          { role: 'assistant', content: reply },
        ]).catch(() => { /* non-fatal */ })
      }

      // 5. Auto-extract new facts from the exchange
      let newNodeCount = 0
      if (!memoPaused) {
        void (async () => {
          try {
            const exchangeText = `User: ${text}\nAssistant: ${reply}`
            const raw     = await callProvider(provider, EXTRACT_SYSTEM, exchangeText)
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            const extracted = JSON.parse(cleaned)
            if (Array.isArray(extracted) && extracted.length > 0) {
              const valid = extracted.filter((e: unknown) =>
                typeof (e as Record<string, unknown>).title === 'string' &&
                typeof (e as Record<string, unknown>).content === 'string'
              )
              if (valid.length > 0) {
                onAgentNodes(valid)
                newNodeCount = valid.length
              }
            }
          } catch { /* non-fatal */ }
          // Update the last assistant message with the node count
          if (newNodeCount > 0) {
            setMessages(prev => {
              const next = [...prev]
              const last = next.findLast(m => m.role === 'assistant')
              if (last) last.newNodeCount = (last.newNodeCount ?? 0) + newNodeCount
              return next
            })
          }
        })()
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        recalledMemories,
        newNodeCount: 0, // will be updated async by extraction above
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const primedCount = primedMemories.length

  return (
    <div className="w-80 shrink-0 border-l t-border t-sidebar flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b t-border shrink-0">
        <Brain className="h-4 w-4 t-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold t-text">Agent chat</p>
          <p className="text-[10px] t-muted truncate">
            {memoPaused
              ? '⏸ memo paused'
              : primingState === 'loading'
              ? 'Loading knowledge…'
              : primedCount > 0
              ? `✦ ${primedCount} memories primed${mem0 ? ' · Mem0' : ''}`
              : mem0 ? '✦ Mem0 live sync' : 'Using graph context'
            }
          </p>
        </div>
        <Button size="icon" variant="ghost"
          className="h-7 w-7 shrink-0 t-muted hover:t-accent"
          title="New discussion — reload context"
          onClick={newDiscussion}>
          <SquarePen className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost"
          className={cn('h-7 w-7 shrink-0', memoPaused ? 'text-orange-400' : 't-muted')}
          title={memoPaused ? 'Resume memorization' : 'Pause — this session won\'t be saved to memory'}
          onClick={() => setMemoPaused(v => !v)}>
          {memoPaused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Provider picker */}
      <div className="px-3 py-2 border-b t-border shrink-0 flex gap-1.5 flex-wrap">
        {PROVIDER_CONFIGS.filter(p => p.type === 'ollama' || localStorage.getItem(p.storageKey)).map(p => (
          <button key={p.id} onClick={() => setProvider(p.id)}
            className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors',
              provider === p.id
                ? 't-accent-border t-accent-subtle t-accent font-medium'
                : 't-border t-muted hover:t-text')}>
            {p.label}{p.free && ' ·free'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 t-muted text-center px-4">
            <Brain className="h-8 w-8 opacity-20" />
            {primingState === 'loading' && (
              <div className="flex items-center gap-1.5 text-xs t-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading relevant knowledge…
              </div>
            )}
            {primingState === 'done' && primedCount > 0 && (
              <div className="space-y-2 w-full">
                <p className="text-xs t-text font-medium">
                  {primedCount} {primedCount === 1 ? 'memory' : 'memories'} ready
                </p>
                <div className="text-left border t-border rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                  {primedMemories.slice(0, 6).map((m, i) => (
                    <p key={i} className="text-[10px] t-muted leading-snug">
                      {m.nodeTitle
                        ? <><span className="t-text font-medium">{m.nodeTitle}</span>{' — '}{m.text.replace(`${m.nodeTitle}: `, '')}</>
                        : m.text
                      }
                    </p>
                  ))}
                  {primedCount > 6 && (
                    <p className="text-[10px] t-muted italic">+{primedCount - 6} more…</p>
                  )}
                </div>
                <p className="text-[10px] t-muted">Start typing — per-message search will add more context.</p>
              </div>
            )}
            {primingState === 'done' && primedCount === 0 && (
              <p className="text-xs">No knowledge loaded yet. Add nodes to your graph first.</p>
            )}
            {primingState === 'error' && (
              <p className="text-xs text-red-400">Failed to load memories. Check Mem0 settings.</p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cn(
              'max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 't-accent-subtle t-accent rounded-br-sm'
                : 't-card t-text border t-border rounded-bl-sm',
            )}>
              {msg.content}
            </div>

            {/* Recall transparency — show which per-message memories were used */}
            {msg.role === 'assistant' && msg.recalledMemories && msg.recalledMemories.length > 0 && (
              <div className="w-full px-1">
                <details className="group">
                  <summary className="flex items-center gap-1 cursor-pointer text-[10px] t-muted hover:t-text list-none">
                    <Zap className="h-2.5 w-2.5" />
                    {msg.recalledMemories.length} memories recalled
                  </summary>
                  <div className="mt-1 pl-3 space-y-0.5 border-l t-border">
                    {msg.recalledMemories.map((m, j) => (
                      <p key={j} className="text-[10px] t-muted leading-snug">
                        {m.nodeTitle
                          ? <><span className="text-blue-400/70 font-medium">{m.nodeTitle}</span>{' — '}{m.text.replace(`${m.nodeTitle}: `, '')}</>
                          : m.text
                        }
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {msg.role === 'assistant' && msg.newNodeCount ? (
              <div className="flex items-center gap-1 px-1 text-[10px] text-amber-400/80">
                <Bot className="h-2.5 w-2.5" />
                {msg.newNodeCount} node{msg.newNodeCount > 1 ? 's' : ''} extracted — confirm in graph
              </div>
            ) : null}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="t-card border t-border rounded-xl rounded-bl-sm px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin t-muted" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1.5 rounded-lg bg-red-900/20 border border-red-500/30 p-2.5 text-[11px] text-red-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t t-border shrink-0 flex gap-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder={memoPaused ? 'Chat (not saved to memory)…' : 'Ask anything… (Enter to send)'}
          rows={2}
          className="flex-1 resize-none text-xs"
        />
        <Button className="self-end h-9 px-3 shrink-0" onClick={() => void send()} disabled={loading || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
