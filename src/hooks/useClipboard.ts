import { useState } from 'react'

/**
 * Copy-to-clipboard with a transient "copied" flag for button feedback.
 * The flag auto-resets after `ms` (default 2s) — long enough to register,
 * short enough that the control returns to its actionable state.
 */
export function useClipboard(ms = 2000) {
  const [copied, setCopied] = useState(false)
  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), ms)
  }
  return { copied, copy }
}
