import { useState, useRef } from 'react'
import { FolderKanban, MessageSquare } from 'lucide-react'

interface Props {
  label: string
  color: string        // 'hsl(235 70% 62%)' — stored project/group color
  nodeCount: number
  bounds: { x: number; y: number; width: number; height: number }
  isConversation?: boolean
  onDragStart?: (e: React.MouseEvent) => void
  onRename?: (newName: string) => void
}

export function CanvasArea({ label, color, nodeCount, bounds, isConversation, onDragStart, onRename }: Props) {
  const bg     = color.replace(')', ' / 0.05)')
  const border = color.replace(')', ' / 0.28)')
  const chip   = color.replace(')', ' / 0.14)')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitRename() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== label) onRename?.(draft.trim())
    else setDraft(label)
  }

  return (
    <div
      className="absolute rounded-2xl pointer-events-none select-none"
      style={{
        left: bounds.x, top: bounds.y,
        width: bounds.width, height: bounds.height,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderStyle: isConversation ? 'dashed' : 'solid',
      }}
    >
      {/* Label chip — draggable, double-click to rename */}
      <div
        className="absolute left-3 top-3 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold pointer-events-auto cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: chip, color, border: `1px solid ${border}` }}
        onMouseDown={e => { e.stopPropagation(); if (!editing) onDragStart?.(e) }}
        onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(label); setTimeout(() => inputRef.current?.select(), 10) }}
      >
        {isConversation
          ? <MessageSquare className="h-2.5 w-2.5 shrink-0" />
          : <FolderKanban className="h-2.5 w-2.5 shrink-0" />}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraft(label) } }}
            onBlur={commitRename}
            className="bg-transparent outline-none w-32 min-w-0"
            style={{ color }}
          />
        ) : (
          <span className="max-w-[180px] truncate">{label}</span>
        )}
        <span className="opacity-55 font-normal text-[10px]">{nodeCount}</span>
      </div>
    </div>
  )
}
