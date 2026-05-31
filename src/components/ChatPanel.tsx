import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Brain, Zap, AlertCircle, PauseCircle, PlayCircle, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PROVIDER_CONFIGS, callProvider, getDefaultProvider } from '@/lib/providers'
import { getMem0Config, mem0Search, mem0Add } from '@/lib/mem0'
import { cn } from '@/lib/utils'
import type { MentalModelNode, NodeCategory, ConfidenceLevel, MemoryGroup } from '@/types/mental-model'

interface RecalledMemory {
  text: string
  nodeId?: string
  nodeTitle?: string
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
  onClose: () => void
}

const CHAT_SYSTEM = (memories: string) => `You are a helpful AI assistant with access to the user's personal knowledge graph.
${memories ? `\nWhat you know about the user:\n${memories}\n\nUse these facts naturally in your responses.` : ''}
Be helpful, direct, and concise.`

const EXTRACT_SYSTEM = `Extract key new persistent facts about the user from this conversation exchange.
Return ONLY a compact JSON array (no markdown fences): [{title, content, category, confidence, memoryType}]
- category: "fact"|"preference"|"goal"|"skill"|"project"|"conversation"
- confidence: "high"|"medium"|"low"
- memoryType: "semantic"|"episodic"
Extract only genuinely new, lasting information. Max 3 items. If nothing memorable, return [].`

export function ChatPanel({ nodes, groups, onAgentNodes, onClose }: Props) {
  const [provider, setProvider] = useState(getDefaultProvider)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Governance paper: pause-memorization toggle
  const [memoPaused, setMemoPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mem0 = getMem0Config()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // compute effective active nodes: respect sensitive flag and group active state
  function getActiveContext(_query: string): RecalledMemory[] {
    const inactiveGroups = new Set(groups.filter(g => !g.active).map(g => g.id))
    return nodes
      .filter(n =>
        n.active &&
        !n.sensitive &&
        !n.groupIds.some(gid => inactiveGroups.has(gid))
      )
      .slice(0, 12)
      .map(n => ({ text: `${n.title}: ${n.content}`, nodeId: n.id, nodeTitle: n.title }))
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // 1. Recall relevant memories
      let recalledMemories: RecalledMemory[] = []
      if (mem0 && !memoPaused) {
        const found = await mem0Search(mem0.apiKey, mem0.userId, text)
        // Try to match Mem0 memories back to graph nodes by text similarity
        recalledMemories = found.map(m => {
          const match = nodes.find(n =>
            n.title.toLowerCase().includes(m.memory.slice(0, 20).toLowerCase()) ||
            m.memory.toLowerCase().includes(n.title.toLowerCase())
          )
          return { text: m.memory, nodeId: match?.id, nodeTitle: match?.title }
        })
      } else {
        recalledMemories = getActiveContext(text)
      }

      const memBlock = recalledMemories.length
        ? recalledMemories.map(m => `• ${m.text}`).join('\n')
        : ''

      // 2. Build conversation history for context
      const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      const userTurn = history ? `${history}\n\nUser: ${text}` : text

      // 3. Call LLM
      const reply = await callProvider(provider, CHAT_SYSTEM(memBlock), userTurn)

      // 4. Save to Mem0 (unless paused)
      if (mem0 && !memoPaused) {
        try {
          await mem0Add(mem0.apiKey, mem0.userId, [
            { role: 'user', content: text },
            { role: 'assistant', content: reply },
          ])
        } catch { /* non-fatal */ }
      }

      // 5. Auto-extract agent memories from exchange (Governance paper: provenance = 'agent')
      let newNodeCount = 0
      if (!memoPaused) {
        try {
          const exchangeText = `User: ${text}\nAssistant: ${reply}`
          const raw = await callProvider(provider, EXTRACT_SYSTEM, exchangeText)
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const extracted = JSON.parse(cleaned)
          if (Array.isArray(extracted) && extracted.length > 0) {
            const valid = extracted.filter(e =>
              typeof e.title === 'string' && typeof e.content === 'string'
            )
            if (valid.length > 0) {
              onAgentNodes(valid)
              newNodeCount = valid.length
            }
          }
        } catch { /* non-fatal */ }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        recalledMemories,
        newNodeCount,
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-80 shrink-0 border-l t-border t-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b t-border shrink-0">
        <Brain className="h-4 w-4 t-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold t-text">Agent chat</p>
          <p className="text-[10px] t-muted truncate">
            {memoPaused ? '⏸ memo paused' : mem0 ? '✦ Mem0 live sync' : 'Using graph context'}
          </p>
        </div>
        {/* Governance paper: pause-memorization toggle */}
        <Button size="icon" variant="ghost" className={cn('h-7 w-7 shrink-0', memoPaused ? 'text-orange-400' : 't-muted')}
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
              provider === p.id ? 't-accent-border t-accent-subtle t-accent font-medium' : 't-border t-muted hover:t-text')}>
            {p.label}{p.free && ' ·free'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 t-muted text-center px-4">
            <Brain className="h-8 w-8 opacity-20" />
            <p className="text-xs">
              {mem0 ? 'Mem0 live sync active. Memories extracted after each exchange appear in the graph as unconfirmed nodes.' : 'Active graph nodes are injected as context.'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cn('max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 't-accent-subtle t-accent rounded-br-sm'
                : 't-card t-text border t-border rounded-bl-sm')}>
              {msg.content}
            </div>

            {/* CHI 2025 + Governance: recall transparency — show which memories were used */}
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
                          ? <><span className="text-blue-400/70 font-medium">{m.nodeTitle}</span> — {m.text.replace(m.nodeTitle + ': ', '')}</>
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
        <Textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={memoPaused ? "Chat (not saved to memory)…" : "Ask anything… (Enter to send)"}
          rows={2} className="flex-1 resize-none text-xs" />
        <Button size="icon" className="h-auto self-end" onClick={send} disabled={loading || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
