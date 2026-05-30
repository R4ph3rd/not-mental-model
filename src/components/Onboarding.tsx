import { useState } from 'react'
import { Brain, KeyRound, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  onDone: () => void
}

const PROVIDERS = [
  { id: 'groq',      label: 'Groq',             storageKey: 'mm-groq-key',     placeholder: 'gsk_…',     free: true,  link: 'https://console.groq.com' },
  { id: 'gemini',    label: 'Gemini',            storageKey: 'mm-gemini-key',   placeholder: 'AIza…',     free: true,  link: 'https://aistudio.google.com/app/apikey' },
  { id: 'cerebras',  label: 'Cerebras',          storageKey: 'mm-cerebras-key', placeholder: 'csk-…',     free: true,  link: 'https://cloud.cerebras.ai' },
  { id: 'anthropic', label: 'Claude',            storageKey: 'mm-claude-key',   placeholder: 'sk-ant-…',  free: false, link: 'https://console.anthropic.com' },
  { id: 'openai',    label: 'OpenAI',            storageKey: 'mm-openai-key',   placeholder: 'sk-…',      free: false, link: 'https://platform.openai.com/api-keys' },
  { id: 'mistral',   label: 'Mistral',           storageKey: 'mm-mistral-key',  placeholder: 'API key…',  free: false, link: 'https://console.mistral.ai' },
]

export function Onboarding({ onDone }: Props) {
  const [selected, setSelected] = useState('groq')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  const provider = PROVIDERS.find(p => p.id === selected)!

  function handleSave() {
    if (key.trim()) localStorage.setItem(provider.storageKey, key.trim())
    localStorage.setItem('mm-onboarding-done', '1')
    setSaved(true)
    setTimeout(onDone, 600)
  }

  function handleSkip() {
    localStorage.setItem('mm-onboarding-done', '1')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="t-ui border t-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl t-accent-subtle flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 t-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold t-text">Welcome to Not-a-mental-model</h1>
            <p className="text-xs t-muted">Add an AI key to extract and import memories</p>
          </div>
        </div>

        {/* Provider grid */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest t-muted">Choose a provider</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelected(p.id); setKey('') }}
                className={cn(
                  'flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg border text-left transition-colors',
                  selected === p.id
                    ? 't-accent-border t-accent-subtle'
                    : 't-border t-card hover:t-text'
                )}
              >
                <span className={cn('text-xs font-medium', selected === p.id ? 't-accent' : 't-text')}>
                  {p.label}
                </span>
                {p.free
                  ? <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">free</span>
                  : <span className="text-[9px] t-muted">paid</span>
                }
              </button>
            ))}
          </div>
          <p className="text-[10px] t-muted">
            Groq, Gemini, and Cerebras have generous free tiers — no credit card needed.{' '}
            <a href={provider.link} target="_blank" rel="noopener noreferrer"
              className="t-accent underline inline-flex items-center gap-0.5">
              Get a {provider.label} key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>
        </div>

        {/* Key input */}
        <div className="space-y-1.5">
          <p className="text-xs t-text font-medium flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 t-accent" />
            {provider.label} API key
          </p>
          <Input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder={provider.placeholder}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <p className="text-[10px] t-muted">Stored only in your browser's localStorage. Never sent to our servers.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="t-muted">
            Skip for now
          </Button>
          <Button size="sm" onClick={handleSave} className="flex-1" disabled={saved}>
            {saved
              ? <><Check className="h-4 w-4" /> Saved</>
              : <>{key.trim() ? 'Save & continue' : 'Continue without key'} <ArrowRight className="h-4 w-4" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
