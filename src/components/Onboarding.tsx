import { useState } from 'react'
import { Brain, KeyRound, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  onDone: () => void
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', storageKey: 'mm-claude-key',  placeholder: 'sk-ant-…' },
  { id: 'openai',    label: 'OpenAI (GPT)',        storageKey: 'mm-openai-key',  placeholder: 'sk-…' },
  { id: 'gemini',    label: 'Google (Gemini)',     storageKey: 'mm-gemini-key',  placeholder: 'AIza…' },
  { id: 'mistral',   label: 'Mistral',             storageKey: 'mm-mistral-key', placeholder: 'API key…' },
]

export function Onboarding({ onDone }: Props) {
  const [selected, setSelected] = useState('anthropic')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  const provider = PROVIDERS.find(p => p.id === selected)!

  function handleSave() {
    if (key.trim()) {
      localStorage.setItem(provider.storageKey, key.trim())
    }
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
            <h1 className="text-base font-semibold t-text">Welcome to Mental Model</h1>
            <p className="text-xs t-muted">Set up an AI key to extract and summarize memories</p>
          </div>
        </div>

        {/* Provider tabs */}
        <div>
          <p className="text-[10px] uppercase tracking-widest t-muted mb-2">Select provider</p>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelected(p.id); setKey('') }}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                  selected === p.id
                    ? 't-accent-border t-accent-subtle t-accent font-medium'
                    : 't-border t-card t-muted hover:t-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
          <p className="text-[10px] t-muted">Stored only in your browser's localStorage.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="t-muted">
            Skip for now
          </Button>
          <Button size="sm" onClick={handleSave} className="flex-1" disabled={saved}>
            {saved
              ? <><Check className="h-4 w-4" /> Saved</>
              : <>{key.trim() ? 'Save & continue' : 'Continue without key'} <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    </div>
  )
}
