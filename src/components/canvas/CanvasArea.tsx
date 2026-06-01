import { FolderKanban, MessageSquare } from 'lucide-react'

interface Props {
  label: string
  color: string        // 'hsl(235 70% 62%)' — stored project/group color
  nodeCount: number
  bounds: { x: number; y: number; width: number; height: number }
  isConversation?: boolean
}

export function CanvasArea({ label, color, nodeCount, bounds, isConversation }: Props) {
  // Modern CSS Level 4 hsl() with alpha: 'hsl(H S L)' → 'hsl(H S L / alpha)'
  const bg     = color.replace(')', ' / 0.05)')
  const border = color.replace(')', ' / 0.28)')
  const chip   = color.replace(')', ' / 0.14)')

  return (
    <div
      className="absolute rounded-2xl pointer-events-none select-none"
      style={{
        left: bounds.x, top: bounds.y,
        width: bounds.width, height: bounds.height,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        // conversation sub-areas get a dashed border to distinguish from project areas
        borderStyle: isConversation ? 'dashed' : 'solid',
      }}
    >
      {/* Label chip — top-left corner */}
      <div
        className="absolute left-3 top-3 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold"
        style={{ backgroundColor: chip, color, border: `1px solid ${border}` }}
      >
        {isConversation
          ? <MessageSquare className="h-2.5 w-2.5 shrink-0" />
          : <FolderKanban className="h-2.5 w-2.5 shrink-0" />}
        <span className="max-w-[180px] truncate">{label}</span>
        <span className="opacity-55 font-normal text-[10px]">{nodeCount}</span>
      </div>
    </div>
  )
}
