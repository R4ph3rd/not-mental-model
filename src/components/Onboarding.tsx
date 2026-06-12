import { useState } from 'react'
import { Brain, KeyRound, ArrowRight, Check, ExternalLink, FolderInput, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  onDone: () => void
  onImport: () => void  // opens Import/Extract dialog
}

type Step = 'choose' | 'setup-key'

const PROVIDERS = [
  { id: 'groq',      label: 'Groq',    storageKey: 'mm-groq-key',     placeholder: 'gsk_…',    free: true,  link: 'https://console.groq.com' },
  { id: 'gemini',    label: 'Gemini',  storageKey: 'mm-gemini-key',   placeholder: 'AIza…',    free: true,  link: 'https://aistudio.google.com/app/apikey' },
  { id: 'cerebras',  label: 'Cerebras',storageKey: 'mm-cerebras-key', placeholder: 'csk-…',    free: true,  link: 'https://cloud.cerebras.ai' },
  { id: 'anthropic', label: 'Claude',  storageKey: 'mm-claude-key',   placeholder: 'sk-ant-…', free: false, link: 'https://console.anthropic.com' },
  { id: 'openai',    label: 'OpenAI',  storageKey: 'mm-openai-key',   placeholder: 'sk-…',     free: false, link: 'https://platform.openai.com/api-keys' },
  { id: 'mistral',   label: 'Mistral', storageKey: 'mm-mistral-key',  placeholder: 'API key…', free: false, link: 'https://console.mistral.ai' },
]

// Wireframe SVG art for "Import" option
function ImportArt() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Chat bubble */}
      <rect x="8" y="10" width="44" height="28" rx="4" strokeDasharray="3 2" />
      <line x1="18" y1="19" x2="42" y2="19" />
      <line x1="18" y1="25" x2="36" y2="25" />
      <line x1="18" y1="31" x2="40" y2="31" />
      {/* Arrow */}
      <line x1="55" y1="24" x2="70" y2="24" />
      <polyline points="65,19 71,24 65,29" />
      {/* Knowledge nodes */}
      <rect x="74" y="8" width="38" height="14" rx="3" />
      <rect x="74" y="28" width="38" height="14" rx="3" />
      <rect x="74" y="48" width="38" height="14" rx="3" />
      <line x1="93" y1="22" x2="93" y2="28" />
      <line x1="93" y1="42" x2="93" y2="48" />
      {/* Labels (short lines) */}
      <line x1="80" y1="15" x2="104" y2="15" strokeWidth="1" />
      <line x1="80" y1="35" x2="100" y2="35" strokeWidth="1" />
      <line x1="80" y1="55" x2="102" y2="55" strokeWidth="1" />
    </svg>
  )
}

// Wireframe SVG art for "Template" option
function TemplateArt() {
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Central node */}
      <circle cx="60" cy="40" r="10" />
      {/* Outer nodes */}
      <circle cx="20" cy="20" r="7" />
      <circle cx="100" cy="20" r="7" />
      <circle cx="20" cy="60" r="7" />
      <circle cx="100" cy="60" r="7" />
      <circle cx="60" cy="8" r="5" />
      {/* Links */}
      <line x1="50" y1="33" x2="26" y2="24" />
      <line x1="70" y1="33" x2="94" y2="24" />
      <line x1="50" y1="47" x2="26" y2="56" />
      <line x1="70" y1="47" x2="94" y2="56" />
      <line x1="60" y1="30" x2="60" y2="13" />
    </svg>
  )
}

export function Onboarding({ onDone, onImport }: Props) {
  const [step, setStep] = useState<Step>('choose')
  const [selected, setSelected] = useState('groq')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  const provider = PROVIDERS.find(p => p.id === selected)!

  function handleTemplate() {
    localStorage.setItem('mm-onboarding-done', '1')
    onDone()
  }

  function handleImportChoice() {
    // Go to key setup first, then open import
    setStep('setup-key')
  }

  function handleSaveKey() {
    if (key.trim()) localStorage.setItem(provider.storageKey, key.trim())
    localStorage.setItem('mm-onboarding-done', '1')
    setSaved(true)
    setTimeout(() => { onDone(); onImport() }, 400)
  }

  function handleSkipKey() {
    localStorage.setItem('mm-onboarding-done', '1')
    onDone()
    onImport()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="t-ui border t-border rounded-2xl shadow-2xl w-full max-w-lg mx-4">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b t-border">
          <div className="h-9 w-9 rounded-xl t-accent-subtle flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 t-accent" />
          </div>
          <div>
            <h1 className="text-base font-semibold t-text">Welcome to Not-a-mental-model</h1>
            <p className="text-xs t-muted">Your personal AI knowledge graph</p>
          </div>
        </div>

        {step === 'choose' ? (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm t-muted text-center">How do you want to get started?</p>

            {/* Two choice cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Import */}
              <button
                onClick={handleImportChoice}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border t-border t-card hover:t-accent-border hover:t-accent-subtle transition-all text-center group"
              >
                <div className="w-full t-muted group-hover:t-accent transition-colors">
                  <ImportArt />
                </div>
                <div className="flex items-center gap-1.5 t-accent">
                  <FolderInput className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold">Import</span>
                </div>
                <p className="text-[11px] t-muted leading-relaxed">
                  Extract from AI conversations, connect Mem0, or load a JSON file
                </p>
                <span className="text-[10px] t-accent border t-accent-border rounded-full px-2 py-0.5">
                  Recommended
                </span>
              </button>

              {/* Template */}
              <button
                onClick={handleTemplate}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border t-border t-card hover:border-white/20 hover:t-text transition-all text-center group"
              >
                <div className="w-full t-muted transition-colors">
                  <TemplateArt />
                </div>
                <div className="flex items-center gap-1.5 t-text">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold">Demo template</span>
                </div>
                <p className="text-[11px] t-muted leading-relaxed">
                  Explore with a pre-built profile. Replace it with yours later.
                </p>
                <span className="text-[10px] t-muted border t-border rounded-full px-2 py-0.5">
                  No API key needed
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm t-text font-medium">Add an API key to power AI features</p>
            <p className="text-xs t-muted">Keys are stored only in your browser. Groq, Gemini and Cerebras are free.</p>

            {/* Provider picker */}
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => { setSelected(p.id); setKey('') }}
                  className={cn('flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg border text-left transition-colors',
                    selected === p.id ? 't-accent-border t-accent-subtle' : 't-border t-card hover:t-text')}>
                  <span className={cn('text-xs font-medium', selected === p.id ? 't-accent' : 't-text')}>{p.label}</span>
                  {p.free
                    ? <span className="text-[9px] px-1 py-0.5 rounded t-accent-subtle t-accent">free</span>
                    : <span className="text-[9px] t-muted">paid</span>}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs t-text font-medium flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 t-accent" />{provider.label} API key
                <a href={provider.link} target="_blank" rel="noopener noreferrer"
                  className="t-accent ml-auto flex items-center gap-0.5 text-[10px] underline">
                  Get key <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </p>
              <Input type="password" value={key} onChange={e => setKey(e.target.value)}
                placeholder={provider.placeholder} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()} />
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSkipKey} className="t-muted">
                Skip for now
              </Button>
              <Button size="sm" onClick={handleSaveKey} className="flex-1" disabled={saved}>
                {saved
                  ? <><Check className="h-4 w-4" /> Saved</>
                  : <>{key.trim() ? 'Save & open import' : 'Continue without key'} <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
