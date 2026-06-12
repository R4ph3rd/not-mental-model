import { ExternalLink } from 'lucide-react'
import { PROVIDER_CONFIGS } from '@/lib/providers'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
}

/**
 * Horizontal chip list to choose the LLM provider for an AI action.
 * Providers without a stored key render dimmed (still selectable, so the
 * user discovers what's possible); a hint links to free keys when none set.
 */
export function ProviderPicker({ value, onChange }: Props) {
  const hasAnyKey = PROVIDER_CONFIGS.some(
    p => p.type !== 'ollama' && localStorage.getItem(p.storageKey),
  )

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest t-muted">AI provider</p>
      <div className="flex flex-wrap gap-1.5">
        {PROVIDER_CONFIGS.map(p => {
          const hasKey = p.type === 'ollama' ? true : !!localStorage.getItem(p.storageKey)
          const active = value === p.id
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.id)}
              className={cn(
                'press flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
                active
                  ? 't-accent-border t-accent-subtle t-accent font-medium'
                  : hasKey
                    ? 't-border t-card t-text hover:t-accent hover:t-accent-border'
                    : 't-border t-card t-muted opacity-50',
              )}
            >
              {p.label}
              {p.free && (
                <span className="text-[9px] px-1 py-0.5 rounded t-accent-subtle t-accent font-medium">
                  free
                </span>
              )}
              {!hasKey && p.type !== 'ollama' && (
                <span className="text-[9px] t-muted">no key</span>
              )}
            </button>
          )
        })}
      </div>
      {!hasAnyKey && (
        <p className="text-[10px] t-muted">
          No keys set. Add one in Settings, or use Ollama locally.{' '}
          <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer"
            className="t-accent underline inline-flex items-center gap-0.5">
            Get a free Groq key <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
      )}
    </div>
  )
}
