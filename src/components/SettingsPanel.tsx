import { useState } from 'react'
import { X, Sun, Moon, KeyRound, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme, COLOR_PRESETS } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

function ApiKeyRow({ label, storageKey, placeholder }: {
  label: string
  storageKey: string
  placeholder: string
}) {
  const [key, setKey] = useState(() => localStorage.getItem(storageKey) ?? '')
  const [saved, setSaved] = useState(false)

  function save() {
    localStorage.setItem(storageKey, key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs t-text font-medium">{label}</p>
      <div className="flex gap-2">
        <Input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-8 text-xs"
        />
        <Button size="sm" variant="secondary" onClick={save} className="h-8 shrink-0">
          {saved ? <Check className="h-3.5 w-3.5 text-green-400" /> : 'Save'}
        </Button>
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
}

export function SettingsPanel({ onClose }: Props) {
  const { colorMode, setColorMode, primaryHue, setPrimaryHue } = useTheme()

  return (
    <div className="w-72 shrink-0 border-l t-border t-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b t-border shrink-0">
        <p className="text-sm font-semibold t-text">Settings</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* ── Appearance ─────────────────────────── */}
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest t-muted">Appearance</p>

          {/* Color mode */}
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Theme</p>
            <div className="flex gap-2">
              <button
                onClick={() => setColorMode('dark')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs border transition-colors',
                  colorMode === 'dark'
                    ? 't-accent-border t-accent-subtle t-accent font-medium'
                    : 't-border t-card t-muted hover:t-text'
                )}
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </button>
              <button
                onClick={() => setColorMode('light')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs border transition-colors',
                  colorMode === 'light'
                    ? 't-accent-border t-accent-subtle t-accent font-medium'
                    : 't-border t-card t-muted hover:t-text'
                )}
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
            </div>
          </div>

          {/* Accent color */}
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Accent color</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(p => (
                <button
                  key={p.hue}
                  title={p.name}
                  onClick={() => setPrimaryHue(p.hue)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                    primaryHue === p.hue ? 'border-white scale-110 shadow-md' : 'border-transparent'
                  )}
                  style={{ backgroundColor: `hsl(${p.hue} 78% 60%)` }}
                />
              ))}
            </div>
            <p className="text-[10px] t-muted">{COLOR_PRESETS.find(p => p.hue === primaryHue)?.name ?? 'Custom'}</p>
          </div>
        </section>

        {/* ── API Keys ───────────────────────────── */}
        <section className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest t-muted flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" /> API Keys
          </p>
          <p className="text-[11px] t-muted">Keys are stored only in your browser's localStorage and sent directly to each provider.</p>
          <p className="text-[10px] text-green-400/80">Free tier providers: Groq, Gemini (AI Studio), Cerebras, Ollama (local)</p>
          <ApiKeyRow label="Groq (free)"        storageKey="mm-groq-key"    placeholder="gsk_…" />
          <ApiKeyRow label="Gemini (free)"      storageKey="mm-gemini-key"  placeholder="AIza…" />
          <ApiKeyRow label="Cerebras (free)"    storageKey="mm-cerebras-key" placeholder="csk-…" />
          <ApiKeyRow label="Anthropic (Claude)" storageKey="mm-claude-key"  placeholder="sk-ant-…" />
          <ApiKeyRow label="OpenAI (GPT)"       storageKey="mm-openai-key"  placeholder="sk-…" />
          <ApiKeyRow label="Mistral"            storageKey="mm-mistral-key" placeholder="API key…" />
          <div className="space-y-1.5">
            <p className="text-xs t-text font-medium">Ollama base URL</p>
            <Input
              type="text"
              defaultValue={localStorage.getItem('mm-ollama-url') ?? ''}
              onChange={e => localStorage.setItem('mm-ollama-url', e.target.value)}
              placeholder="http://localhost:11434"
              className="h-8 text-xs"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
