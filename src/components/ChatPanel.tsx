import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Brain, Zap, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PROVIDER_CONFIGS, callProvider, getDefaultProvider } from '@/lib/providers'
import { getMem0Config, mem0Search, mem0Add } from '@/lib/mem0'
import { cn } from '@/lib/utils'
import type { MentalModelNode } from '@/types/mental-model'

interface Message {
  role: 'user' | 'assistant'
  content: string
  memoriesUsed?: string[]
  newMemories?: number
}

interface Props {
  nodes: MentalModelNode[]
  onClose: () => void
}

const CHAT_SYSTEM = (memories: string) => `You are a helpful AI assistant with access to the user's personal knowledge graph.

${memories ? `What you know about the user:\n${memories}\n\nUse these facts naturally in your responses.` : 'No memories loaded yet — you will learn about the user through this conversation.'}

Be helpful, direct, and concise. Do not summarize or repeat back what the user just said.`

export function ChatPanel({ nodes, onClose }: Props) {
  const [provider, setProvider] = useState(getDefaultProvider)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mem0 = getMem0Config()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      let memoriesUsed: string[] = []
      if (mem0) {
        const found = await mem0Search(mem0.apiKey, mem0.userId, text)
        memoriesUsed = found.map(m => m.memory)
      } else {
        // Fall back to active nodes from graph
        memoriesUsed = nodes
          .filter(n => n.active)
          .slice(0, 10)
          .map(n => `${n.title}: ${n.content}`)
      }

      const memBlock = memoriesUsed.length
        ? memoriesUsed.map(m => `• ${m}`).join('\n')
        : ''

      // 2. Build history for LLM
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const systemPrompt = CHAT_SYSTEM(memBlock)

      // For providers that use messages array (all except Anthropic which has a system param)
      // We pass system+history as a single userMsg to callProvider's simple interface
      const fullContext = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
      const userTurn = fullContext ? `${fullContext}\n\nUser: ${text}` : text

      // 3. Call LLM
      const reply = await callProvider(provider, systemPrompt, userTurn)

      // 4. Save to Mem0
      let newMemories = 0
      if (mem0) {
        try {
          await mem0Add(mem0.apiKey, mem0.userId, [
            { role: 'user', content: text },
            { role: 'assistant', content: reply },
          ])
          newMemories = 1 // Mem0 auto-extracts; we don't get exact count
        } catch {
          // Non-fatal: continue even if Mem0 save fails
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        memoriesUsed,
        newMemories: mem0 ? newMemories : 0,
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setMessages(prev => prev.slice(0, -1)) // remove pending user message
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
            {mem0 ? '✦ Mem0 live sync' : 'Using graph context (no Mem0)'}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Provider picker */}
      <div className="px-3 py-2 border-b t-border shrink-0 flex gap-1.5 flex-wrap">
        {PROVIDER_CONFIGS.filter(p => p.type === 'ollama' || localStorage.getItem(p.storageKey)).map(p => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded border transition-colors',
              provider === p.id
                ? 't-accent-border t-accent-subtle t-accent font-medium'
                : 't-border t-muted hover:t-text'
            )}
          >
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
              {mem0
                ? 'Chat here — memories are automatically synced with Mem0 and appear in your graph.'
                : 'Chat here — active graph nodes are injected as context. Connect Mem0 in Settings for live memory sync.'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cn(
              'max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 't-accent-subtle t-accent rounded-br-sm'
                : 't-card t-text border t-border rounded-bl-sm'
            )}>
              {msg.content}
            </div>

            {msg.role === 'assistant' && (msg.memoriesUsed?.length || msg.newMemories) ? (
              <div className="flex items-center gap-2 px-1 text-[9px] t-muted">
                {msg.memoriesUsed?.length ? (
                  <span className="flex items-center gap-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    {msg.memoriesUsed.length} memories recalled
                  </span>
                ) : null}
                {msg.newMemories ? (
                  <span className="text-green-400/70">+ saved to Mem0</span>
                ) : null}
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
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything… (Enter to send)"
          rows={2}
          className="flex-1 resize-none text-xs"
        />
        <Button size="icon" className="h-auto self-end" onClick={send} disabled={loading || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
