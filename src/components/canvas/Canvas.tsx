import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CanvasLinks } from './CanvasLinks'
import { CanvasNode } from './CanvasNode'
import { computeDefaultPositions, CARD_W, CARD_H } from './layout'
import type { MentalModelNode } from '@/types/mental-model'

interface Props {
  nodes: MentalModelNode[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, multi: boolean) => void
  onDeleteNode: (id: string) => void
  onToggleActive: (id: string) => void
  onTogglePin: (id: string) => void
  onSetPosition: (id: string, x: number, y: number) => void
  onEditRequest: (id: string) => void
}

interface DragState {
  type: 'node'; id: string
  startMouseX: number; startMouseY: number
  startNodeX: number; startNodeY: number
  x: number; y: number; hasMoved: boolean
}

interface PanState {
  startMouseX: number; startMouseY: number
  startPanX: number; startPanY: number
}

export function Canvas({
  nodes, selectedIds,
  onToggleSelect, onDeleteNode,
  onToggleActive, onTogglePin, onSetPosition, onEditRequest,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [scale, setScale] = useState(1)

  const dragRef = useRef<DragState | null>(null)
  const panRef  = useRef<PanState | null>(null)
  const [, forceUpdate] = useState(0)

  const defaultPositions = useMemo(() => computeDefaultPositions(nodes), [nodes])

  function getPos(node: MentalModelNode) {
    const drag = dragRef.current
    if (drag?.id === node.id) return { x: drag.x, y: drag.y }
    return node.position ?? defaultPositions[node.id] ?? { x: 100, y: 100 }
  }

  const positions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) map[n.id] = getPos(n)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, defaultPositions])

  function handleNodeMouseDown(e: React.MouseEvent, id: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === id)!
    const pos = node.position ?? defaultPositions[id] ?? { x: 0, y: 0 }
    dragRef.current = {
      type: 'node', id,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startNodeX: pos.x, startNodeY: pos.y,
      x: pos.x, y: pos.y, hasMoved: false,
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    panRef.current = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startPanX: pan.x, startPanY: pan.y,
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    let needsUpdate = false
    if (dragRef.current) {
      const d = dragRef.current
      const dx = (e.clientX - d.startMouseX) / scale
      const dy = (e.clientY - d.startMouseY) / scale
      dragRef.current = {
        ...d, x: d.startNodeX + dx, y: d.startNodeY + dy,
        hasMoved: d.hasMoved || Math.abs(dx) > 4 || Math.abs(dy) > 4,
      }
      needsUpdate = true
    }
    if (panRef.current) {
      const p = panRef.current
      setPan({ x: p.startPanX + (e.clientX - p.startMouseX), y: p.startPanY + (e.clientY - p.startMouseY) })
    }
    if (needsUpdate) forceUpdate(v => v + 1)
  }, [scale])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragRef.current) {
      const d = dragRef.current
      if (!d.hasMoved) {
        const multi = e.ctrlKey || e.metaKey
        onToggleSelect(d.id, multi)
        if (!multi) onEditRequest(d.id)
      } else {
        onSetPosition(d.id, d.x, d.y)
      }
      dragRef.current = null
    }
    panRef.current = null
  }, [onToggleSelect, onSetPosition, onEditRequest])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const canvasX = (mouseX - pan.x) / scale
    const canvasY = (mouseY - pan.y) / scale
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.25, Math.min(2.5, scale * delta))
    setPan({ x: mouseX - canvasX * newScale, y: mouseY - canvasY * newScale })
    setScale(newScale)
  }

  function fitAll() {
    if (!containerRef.current || nodes.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const allPos = nodes.map(n => getPos(n))
    const minX = Math.min(...allPos.map(p => p.x))
    const minY = Math.min(...allPos.map(p => p.y))
    const maxX = Math.max(...allPos.map(p => p.x)) + CARD_W
    const maxY = Math.max(...allPos.map(p => p.y)) + CARD_H
    const pad = 80
    const newScale = Math.min((rect.width - pad * 2) / (maxX - minX), (rect.height - pad * 2) / (maxY - minY), 1.5)
    setPan({ x: pad - minX * newScale, y: pad - minY * newScale })
    setScale(newScale)
  }

  const livePositions = useMemo(() => {
    const d = dragRef.current
    if (!d) return positions
    return { ...positions, [d.id]: { x: d.x, y: d.y } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, dragRef.current])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden t-deep cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: 'radial-gradient(circle, rgb(var(--brd) / 0.6) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onMouseDown={handleCanvasMouseDown}
      onWheel={handleWheel}
    >
      <div
        className="absolute"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <CanvasLinks nodes={nodes} positions={livePositions} />
        {nodes.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            position={livePositions[node.id] ?? { x: 0, y: 0 }}
            selected={selectedIds.has(node.id)}
            onMouseDown={handleNodeMouseDown}
            onToggleActive={onToggleActive}
            onTogglePin={onTogglePin}
            onDelete={id => { onDeleteNode(id) }}
            onEditRequest={onEditRequest}
          />
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setScale(s => Math.min(2.5, s * 1.2))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.25, s * 0.8))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={fitAll} title="Fit all">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 text-[10px] t-muted">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
