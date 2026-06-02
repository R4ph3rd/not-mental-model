import { useState, useRef, useEffect } from 'react'

const PRESETS = [
  'hsl(0 65% 55%)',   'hsl(20 70% 55%)',  'hsl(45 70% 55%)',  'hsl(85 55% 45%)',
  'hsl(150 55% 45%)', 'hsl(195 65% 52%)', 'hsl(220 65% 58%)', 'hsl(235 70% 62%)',
  'hsl(255 65% 62%)', 'hsl(285 65% 58%)', 'hsl(315 65% 58%)', 'hsl(330 65% 58%)',
]

interface Props { color: string; onChange: (c: string) => void }

export function ColorPicker({ color, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20 hover:ring-white/60 transition-all"
        style={{ backgroundColor: color }}
        title="Change color"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
      />
      {open && (
        <div className="absolute left-0 top-5 z-50 p-2 t-ui border t-border rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 w-max">
          {PRESETS.map(c => (
            <button
              key={c}
              className="h-5 w-5 rounded-full hover:scale-110 transition-transform ring-1 ring-white/10"
              style={{ backgroundColor: c, outline: c === color ? '2px solid white' : 'none', outlineOffset: '2px' }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onChange(c); setOpen(false) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
