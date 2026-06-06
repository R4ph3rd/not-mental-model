import { useState, useRef, useEffect } from 'react'
import { Clipboard, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MentalModelNode } from '@/types/mental-model'

interface Props {
  allNodes: MentalModelNode[]
  filteredNodes: MentalModelNode[]
  isVisible: (n: MentalModelNode) => boolean
  groupLabel?: string
  conversationLabel?: string
  categoryFilter: string
  hasSearch: boolean
}

function buildText(nodes: MentalModelNode[], label: string | null, includeInstruction: boolean): string {
  const grouped: Record<string, MentalModelNode[]> = {}
  for (const n of nodes) {
    const key = n.category.charAt(0).toUpperCase() + n.category.slice(1) + 's'
    ;(grouped[key] ??= []).push(n)
  }
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const heading = label ? `## My context (${label}) — ${date}` : `## My context — ${date}`
  const lines = [`${heading}\n`]
  for (const [grp, items] of Object.entries(grouped)) {
    lines.push(`### ${grp}`)
    for (const n of items) lines.push(`- **${n.title}**: ${n.content}`)
    lines.push('')
  }
  if (includeInstruction) {
    lines.push('---')
    lines.push(
      'This context was exported from my personal knowledge graph and reflects my up-to-date information. ' +
      'If any of the above differs from or adds to what you already know about me, please update your memory accordingly.',
    )
  }
  return lines.join('\n')
}

export function CopyContextButton({
  filteredNodes, isVisible,
  groupLabel, conversationLabel, categoryFilter, hasSearch,
}: Props) {
  const [open, setOpen]               = useState(false)
  const [instruction, setInstruction] = useState(false)
  const [copied, setCopied]           = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hasFilter = !!(groupLabel || conversationLabel || categoryFilter !== 'all' || hasSearch)
  const viewNodes = filteredNodes.filter(isVisible)
  const viewCount = viewNodes.length

  const contextLabel = conversationLabel ?? groupLabel ?? (categoryFilter !== 'all' ? categoryFilter : null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function doCopy() {
    if (viewNodes.length === 0) return
    navigator.clipboard.writeText(buildText(viewNodes, contextLabel, instruction))
    setCopied(true)
    setOpen(false)
    setTimeout(() => setCopied(false), 2000)
  }

  // Skip popover when no instruction opt-in is needed (no filter = no ambiguity)
  function handleClick() {
    if (!hasFilter && !instruction) { doCopy(); return }
    setOpen(v => !v)
  }

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm" variant="ghost"
        onClick={handleClick}
        title={`Copy context — ${viewCount} node${viewCount !== 1 ? 's' : ''} visible in current view`}
      >
        {copied
          ? <ClipboardCheck className="h-3.5 w-3.5 text-green-400" />
          : <Clipboard className="h-3.5 w-3.5" />}
        {!copied && (
          <span className="text-[10px] tabular-nums opacity-60">{viewCount}</span>
        )}
      </Button>

      {open && (
        <div className={cn(
          'absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border t-border shadow-xl py-3 px-3 space-y-3',
          'bg-[color:rgb(var(--bg-card))]',
        )}>
          <p className="text-xs font-semibold t-text">Copy context</p>

          {/* Active filter hint */}
          {hasFilter && (
            <p className="text-[10px] t-muted leading-snug">
              {[
                conversationLabel && `conversation: ${conversationLabel}`,
                groupLabel && `group: ${groupLabel}`,
                categoryFilter !== 'all' && `category: ${categoryFilter}`,
                hasSearch && 'search filter active',
              ].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Opt-in agent instruction */}
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={instruction}
              onChange={e => setInstruction(e.target.checked)}
              className="mt-0.5 accent-[hsl(var(--p-h)_var(--p-s)_var(--p-l))]"
            />
            <span className="text-[11px] t-muted group-hover:t-text transition-colors leading-snug">
              Include agent instruction
              <span className="block text-[10px] opacity-50 mt-0.5">
                Asks the recipient to update their memory. Only enable for agents with write access.
              </span>
            </span>
          </label>

          <Button size="sm" className="w-full" onClick={doCopy} disabled={viewCount === 0}>
            Copy {viewCount} node{viewCount !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
