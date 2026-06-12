/** Shared formatting helpers. */

/**
 * Compact "time ago" label. Accepts an ISO string or epoch ms.
 * Seconds precision below one minute, then m / h / d.
 */
export function relativeTime(when: string | number): string {
  const ts = typeof when === 'number' ? when : new Date(when).getTime()
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5)   return 'just now'
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
