import { useState } from 'react'
import {
  X, Sun, Moon, KeyRound, Check, Wifi, WifiOff, ExternalLink,
  Download, FolderInput, Server, Sparkles, Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme, COLOR_PRESETS } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

function ApiKeyRow({ label, storageKey, placeholder, type = 'password' }: {
  label: string; storageKey: string; placeholder: string; type?: string
}) {
  const [val, setVal] = useState(() => localStorage.getItem(storageKey) ?? '')
  const [saved, setSaved] = useState(false)

  function save() {
    localStorage.setItem(storageKey, val.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs t-text font-medium">{label}</p>
      <div className="flex gap-2">
        <Input type={type} value={val} onChange={e => setVal(e.target.value)}
          placeholder={placeholder} className="flex-1 h-8 text-xs"
          onKeyDown={e => e.key === 'Enter' && save()} />
        <Button size="sm" variant="secondary" onClick={save} className="h-8 shrink-0">
          {saved ? <Check className="h-3.5 w-3.5 text-green-400" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
  onExtract: () => void
  onImportMemory: () => void
  onBackup: () => void
  onRestore: () => void
  onConnect: () => void
}

export function SettingsPanel({ onClose, onExtract, onImportMemory, onBackup, onRestore, onConnect }: Props) {
  const { colorMode, setColorMode, primaryHue, setPrimaryHue } = useTheme()
  const hasMem0Key  = !!localStorage.getItem('mm-mem0-key')
  const hasMem0User = !!localStorage.getItem('mm-mem0-user')
  const mem0Active  = hasMem0Key && hasMem0User

  return (
    <div className="w-72 shrink-0 border-l t-border t-sidebar flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b t-border shrink-0">
        <p className="text-sm font-semibold t-text">Settings</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Data & Import ───────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest t-muted">Data &amp; Import</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" className="h-8 text-xs justify-start gap-1.5" onClick={onExtract}>
              <Sparkles className="h-3.5 w-3.5 t-accent shrink-0" />Extract
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs justify-start gap-1.5" onClick={onImportMemory}>
              <Brain className="h-3.5 w-3.5 t-accent shrink-0" />Import Memory
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs justify-start gap-1.5" onClick={onBackup}>
              <Download className="h-3.5 w-3.5 shrink-0" />Save Backup
            </Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs justify-start gap-1.5" onClick={onRestore}>
              <FolderInput className="h-3.5 w-3.5 shrink-0" />Restore
            </Button>
          </div>
          <Button size="sm" variant="secondary" className="w-full h-8 text-xs justify-start gap-1.5" onClick={onConnect}>
            <Server className="h-3.5 w-3.5 shrink-0" />Connect to agents (MCP)
          </Button>
        </section>

        {/* ── Memory Sync ─────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest t-muted flex items-center gap-1.5">
            <Wifi className="h-3 w-3" /> Memory sync
          </p>

          {/* Mem0 status */}
          <div className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 border text-xs',
            mem0Active ? 'bg-green-500/8 border-green-500/20' : 'bg-yellow-500/8 border-yellow-500/20'
          )}>
            {mem0Active
              ? <Wifi className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-400" />
              : <WifiOff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400" />}
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium', mem0Active ? 'text-green-400' : 'text-yellow-400')}>
                Mem0{!mem0Active && ' — not configured'}
              </p>
              <p className="text-[10px] t-muted mt-0.5">
                {mem0Active ? 'Live bidirectional sync active' : 'Add your API key below to enable live sync'}
              </p>
            </div>
            <a href="https://app.mem0.ai" target="_blank" rel="noopener noreferrer" className="t-muted hover:t-accent mt-0.5">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Other platforms */}
          {(['claude.ai', 'ChatGPT', 'Gemini (web)'] as const).map(name => (
            <div key={name} className="flex items-start gap-2 rounded-lg px-3 py-2 border t-card t-border opacity-60 text-xs">
              <WifiOff className="h-3.5 w-3.5 mt-0.5 shrink-0 t-muted" />
              <div>
                <p className="font-medium t-muted">{name}</p>
                <p className="text-[10px] t-muted mt-0.5">No memory API — use "Copy context" to sync</p>
              </div>
            </div>
          ))}

          <ApiKeyRow label="Mem0 API key" storageKey="mm-mem0-key" placeholder="m0-…" />
          <ApiKeyRow label="Mem0 user ID" storageKey="mm-mem0-user" placeholder="your-username" type="text" />
          <p className="text-[10px] t-muted">User ID scopes your memories in Mem0 — any string works.</p>
        </section>

        {/* ── Appearance ─────────────────────────────── */}
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest t-muted">Appearance</p>
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Theme</p>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map(mode => (
                <button key={mode} onClick={() => setColorMode(mode)} className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs border transition-colors',
                  colorMode === mode ? 't-accent-border t-accent-subtle t-accent font-medium' : 't-border t-card t-muted hover:t-text'
                )}>
                  {mode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Accent color</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(p => (
                <button key={p.hue} title={p.name} onClick={() => setPrimaryHue(p.hue)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                    primaryHue === p.hue ? 'border-white scale-110 shadow-md' : 'border-transparent')}
                  style={{ backgroundColor: `hsl(${p.hue} 78% 60%)` }} />
              ))}
            </div>
            <p className="text-[10px] t-muted">{COLOR_PRESETS.find(p => p.hue === primaryHue)?.name ?? 'Custom'}</p>
          </div>
        </section>

        {/* ── LLM API Keys ───────────────────────────── */}
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest t-muted flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" /> LLM API keys
          </p>
          <p className="text-[10px] text-green-400/80">Free tiers: Groq, Gemini AI Studio, Cerebras, Ollama (local)</p>
          <ApiKeyRow label="Groq (free)"        storageKey="mm-groq-key"     placeholder="gsk_…" />
          <ApiKeyRow label="Gemini AI Studio (free)" storageKey="mm-gemini-key" placeholder="AIza…" />
          <ApiKeyRow label="Cerebras (free)"    storageKey="mm-cerebras-key" placeholder="csk-…" />
          <ApiKeyRow label="Anthropic (Claude)" storageKey="mm-claude-key"   placeholder="sk-ant-…" />
          <ApiKeyRow label="OpenAI (GPT)"       storageKey="mm-openai-key"   placeholder="sk-…" />
          <ApiKeyRow label="Mistral"            storageKey="mm-mistral-key"  placeholder="API key…" />
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Ollama base URL</p>
            <Input type="text" defaultValue={localStorage.getItem('mm-ollama-url') ?? ''}
              onChange={e => localStorage.setItem('mm-ollama-url', e.target.value)}
              placeholder="http://localhost:11434" className="h-8 text-xs" />
          </div>
        </section>
      </div>
    </div>
  )
}
