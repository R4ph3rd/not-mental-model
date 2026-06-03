import { useRef, useEffect, useCallback } from 'react'
import type { MentalModelNode, MemoryGroup, Project } from '@/types/mental-model'

// ── Force parameters ──────────────────────────────────────────────────────────
const REPULSION     = 5000
const SPRING_LEN    = 110
const SPRING_K      = 0.04
const CENTER_K      = 0.004
const DAMPING       = 0.82
const MIN_DIST      = 28
const MAX_SIM_STEPS = 450

// ── Category fallback colors (matches Sidebar CATEGORY_DOT) ──────────────────
const CAT_COLORS: Record<string, string> = {
  fact:         '#4ade80',
  preference:   '#fb923c',
  goal:         '#f472b6',
  skill:        '#22d3ee',
  project:      '#60a5fa',
  conversation: '#a78bfa',
}

interface Vec2 { x: number; y: number }

interface Props {
  nodes: MentalModelNode[]
  selectedIds: Set<string>
  onSelectNode: (id: string) => void
  groups?: MemoryGroup[]
  projects?: Project[]
  focusNodeId?: string | null
  onFocusConsumed?: () => void
}

// ── Standalone helpers (no stale closure issues) ─────────────────────────────
function resolveColor(node: MentalModelNode, groups?: MemoryGroup[], projects?: Project[]): string {
  if (node.projectId) {
    const c = projects?.find(p => p.id === node.projectId)?.color
    if (c) return c
  }
  if (node.groupIds[0]) {
    const c = groups?.find(g => g.id === node.groupIds[0])?.color
    if (c) return c
  }
  return CAT_COLORS[node.category] ?? '#888'
}

function resolveRadius(node: MentalModelNode): number {
  // size ∝ retention (importance) × connectivity (links)
  const score = node.importance * (node.linkedIds.length + 1)
  return Math.max(5, Math.min(22, 4 + Math.sqrt(score) * 4.5))
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GraphView({
  nodes, selectedIds, onSelectNode,
  groups, projects, focusNodeId, onFocusConsumed,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number | undefined>(undefined)

  // Simulation state (in refs — never triggers re-renders)
  const posRef       = useRef<Record<string, Vec2>>({})
  const velRef       = useRef<Record<string, Vec2>>({})
  const stepsRef     = useRef(0)
  const pinnedIdRef  = useRef<string | null>(null)

  // View state (in refs — canvas redraws via RAF, not React)
  const panRef       = useRef<Vec2>({ x: 0, y: 0 })
  const scaleRef     = useRef<number>(1)

  // Interaction state (in refs)
  const hoveredIdRef  = useRef<string | null>(null)
  const panDragRef    = useRef<{ startMX: number; startMY: number; startPX: number; startPY: number } | null>(null)
  const nodeDragRef   = useRef<{ id: string; startMX: number; startMY: number } | null>(null)

  // Latest props snapshot (so RAF callbacks always read fresh values)
  const propsRef = useRef({ nodes, selectedIds, onSelectNode, groups, projects })
  propsRef.current = { nodes, selectedIds, onSelectNode, groups, projects }

  // ── Initialize positions when nodes change ──────────────────────────────────
  useEffect(() => {
    const existing = posRef.current
    const newPos: Record<string, Vec2> = {}
    const newVel: Record<string, Vec2> = {}
    const n = nodes.length

    nodes.forEach((node, i) => {
      if (existing[node.id]) {
        newPos[node.id] = existing[node.id]
        newVel[node.id] = velRef.current[node.id] ?? { x: 0, y: 0 }
      } else {
        const angle = (i / Math.max(n, 1)) * Math.PI * 2
        const r = 80 + Math.sqrt(n) * 18
        newPos[node.id] = {
          x: Math.cos(angle) * r + (Math.random() - 0.5) * 50,
          y: Math.sin(angle) * r + (Math.random() - 0.5) * 50,
        }
        newVel[node.id] = { x: 0, y: 0 }
        stepsRef.current = 0 // new node → restart sim
      }
    })

    posRef.current = newPos
    velRef.current = newVel
  }, [nodes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus from sidebar ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!focusNodeId) return
    const p = posRef.current[focusNodeId]
    if (!p) return
    const targetScale = Math.max(scaleRef.current, 1.0)
    panRef.current = { x: -p.x * targetScale, y: -p.y * targetScale }
    scaleRef.current = targetScale
    onFocusConsumed?.()
  }, [focusNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── World ↔ screen helpers ──────────────────────────────────────────────────
  function screenToWorld(screenX: number, screenY: number, canvas: HTMLCanvasElement): Vec2 {
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    return {
      x: (screenX - w / 2 - panRef.current.x) / scaleRef.current,
      y: (screenY - h / 2 - panRef.current.y) / scaleRef.current,
    }
  }

  function hitTest(wx: number, wy: number): string | null {
    const { nodes, groups, projects } = propsRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      const p = posRef.current[node.id]
      if (!p) continue
      const r = resolveRadius(node)
      const dx = wx - p.x, dy = wy - p.y
      if (dx * dx + dy * dy <= (r + 5) * (r + 5)) return node.id
    }
    // suppress "used before defined" for groups/projects
    void groups; void projects
    return null
  }

  // ── Draw (pure canvas 2D, no React re-renders) ──────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.offsetWidth
    const cssH = canvas.offsetHeight
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width  = cssW * dpr
      canvas.height = cssH * dpr
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const pan   = panRef.current
    const scale = scaleRef.current
    const { nodes, selectedIds, groups, projects } = propsRef.current
    const pos       = posRef.current
    const hoveredId = hoveredIdRef.current

    // Apply world transform: center + pan + scale
    ctx.translate(cssW / 2 + pan.x, cssH / 2 + pan.y)
    ctx.scale(scale, scale)

    // ── Links ──────────────────────────────────────────────────────────────────
    const drawnLinks = new Set<string>()
    ctx.lineWidth = 0.8 / scale
    for (const node of nodes) {
      const pa = pos[node.id]
      if (!pa) continue
      for (const lid of node.linkedIds) {
        const key = node.id < lid ? `${node.id}:${lid}` : `${lid}:${node.id}`
        if (drawnLinks.has(key)) continue
        drawnLinks.add(key)
        const pb = pos[lid]
        if (!pb) continue
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = 'rgba(255,255,255,0.13)'
        ctx.stroke()
      }
    }

    // ── Nodes ──────────────────────────────────────────────────────────────────
    for (const node of nodes) {
      const p = pos[node.id]
      if (!p) continue
      const r          = resolveRadius(node)
      const color      = resolveColor(node, groups, projects)
      const isSelected = selectedIds.has(node.id)
      const isHovered  = node.id === hoveredId

      // Glow halo — use globalAlpha so HSL/hex colors work equally
      if (isHovered) {
        ctx.save()
        ctx.globalAlpha = 0.35
        const grad = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 10)
        grad.addColorStop(0, color)
        grad.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(p.x, p.y, r + 10, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 2 / scale
        ctx.stroke()
      }

      // Node fill
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = node.active ? color : color + '44'
      ctx.fill()

      // Always-visible label for selected nodes; hover label for others
      if (isHovered || isSelected) {
        const label    = node.title.length > 36 ? node.title.slice(0, 34) + '…' : node.title
        const fontSize = Math.max(10, 12 / scale)
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`

        const tw      = ctx.measureText(label).width
        const padH    = 4 / scale
        const padV    = 3 / scale
        const boxW    = tw + padH * 2
        const boxH    = fontSize + padV * 2
        const bx      = p.x - boxW / 2
        const by      = p.y - r - boxH - 5 / scale

        roundedRect(ctx, bx, by, boxW, boxH, 4 / scale)
        ctx.fillStyle = 'rgba(0,0,0,0.72)'
        ctx.fill()

        ctx.fillStyle = 'rgba(255,255,255,0.94)'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, p.x, by + boxH / 2)
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'alphabetic'
      }
    }

    ctx.restore()
  }, [])

  // ── Simulation + render loop ─────────────────────────────────────────────────
  const tick = useCallback(() => {
    const { nodes } = propsRef.current
    const pos   = posRef.current
    const vel   = velRef.current
    const pinned = pinnedIdRef.current

    if (stepsRef.current < MAX_SIM_STEPS && nodes.length > 1) {
      const forces: Record<string, Vec2> = {}
      for (const n of nodes) forces[n.id] = { x: 0, y: 0 }

      // Repulsion — O(n²), fine for <1000 nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const pa = pos[a.id], pb = pos[b.id]
          if (!pa || !pb) continue
          const dx = pa.x - pb.x, dy = pa.y - pb.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const safe = Math.max(dist, MIN_DIST)
          const f    = REPULSION / (safe * safe)
          const nx   = dx / dist, ny = dy / dist
          forces[a.id].x += nx * f;  forces[a.id].y += ny * f
          forces[b.id].x -= nx * f;  forces[b.id].y -= ny * f
        }
      }

      // Spring attraction on linked pairs
      for (const node of nodes) {
        for (const lid of node.linkedIds) {
          const pa = pos[node.id], pb = pos[lid]
          if (!pa || !pb) continue
          const dx = pb.x - pa.x, dy = pb.y - pa.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const f    = SPRING_K * (dist - SPRING_LEN)
          const fx   = (dx / dist) * f, fy = (dy / dist) * f
          forces[node.id].x += fx;  forces[node.id].y += fy
          if (forces[lid]) { forces[lid].x -= fx;  forces[lid].y -= fy }
        }
      }

      // Weak centering
      for (const node of nodes) {
        const p = pos[node.id]
        if (!p) continue
        forces[node.id].x -= p.x * CENTER_K
        forces[node.id].y -= p.y * CENTER_K
      }

      // Integrate
      for (const node of nodes) {
        if (node.id === pinned) continue
        const v = vel[node.id], f = forces[node.id]
        if (!v || !f) continue
        v.x = (v.x + f.x) * DAMPING
        v.y = (v.y + f.y) * DAMPING
        pos[node.id].x += v.x
        pos[node.id].y += v.y
      }

      stepsRef.current++
    }

    draw()
    rafRef.current = requestAnimationFrame(tick)
  }, [draw])

  // Start / stop the loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [tick])

  // ── Mouse handlers ────────────────────────────────────────────────────────────
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    // Canvas pan
    const pd = panDragRef.current
    if (pd) {
      panRef.current = {
        x: pd.startPX + (e.clientX - pd.startMX),
        y: pd.startPY + (e.clientY - pd.startMY),
      }
      return
    }

    // Node drag
    const nd = nodeDragRef.current
    if (nd) {
      const rect = canvas.getBoundingClientRect()
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, canvas)
      posRef.current[nd.id] = world
      velRef.current[nd.id] = { x: 0, y: 0 }
      stepsRef.current = Math.min(stepsRef.current, MAX_SIM_STEPS - 60) // light re-run
      return
    }

    // Hover
    const rect  = canvas.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, canvas)
    const hit   = hitTest(world.x, world.y)
    if (hit !== hoveredIdRef.current) {
      hoveredIdRef.current = hit
      canvas.style.cursor  = hit ? 'pointer' : 'grab'
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect  = canvas.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, canvas)
    const hit   = hitTest(world.x, world.y)

    if (e.button === 0) {
      if (hit) {
        pinnedIdRef.current  = hit
        nodeDragRef.current  = { id: hit, startMX: e.clientX, startMY: e.clientY }
        velRef.current[hit]  = { x: 0, y: 0 }
        canvas.style.cursor  = 'grabbing'
      } else {
        panDragRef.current  = {
          startMX: e.clientX, startMY: e.clientY,
          startPX: panRef.current.x, startPY: panRef.current.y,
        }
        canvas.style.cursor = 'grabbing'
      }
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const nd = nodeDragRef.current

    // Click (not drag) on a node → select
    if (nd) {
      const dx = e.clientX - nd.startMX, dy = e.clientY - nd.startMY
      if (Math.sqrt(dx * dx + dy * dy) < 6) {
        propsRef.current.onSelectNode(nd.id)
      }
    }

    pinnedIdRef.current = null
    nodeDragRef.current = null
    panDragRef.current  = null
    if (canvas) canvas.style.cursor = hoveredIdRef.current ? 'pointer' : 'grab'
  }

  // Non-passive wheel listener so e.preventDefault() blocks browser page-zoom (ctrl+scroll / pinch)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect  = canvas.getBoundingClientRect()
      const cx    = e.clientX - rect.left - canvas.offsetWidth  / 2 - panRef.current.x
      const cy    = e.clientY - rect.top  - canvas.offsetHeight / 2 - panRef.current.y
      const factor    = e.deltaY > 0 ? 0.9 : 1.1
      const newScale  = Math.max(0.15, Math.min(4, scaleRef.current * factor))
      const scaleDelta = newScale / scaleRef.current
      panRef.current  = {
        x: panRef.current.x - cx * (scaleDelta - 1),
        y: panRef.current.y - cy * (scaleDelta - 1),
      }
      scaleRef.current = newScale
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [])

  function onMouseLeave() {
    hoveredIdRef.current = null
    panDragRef.current   = null
    // Don't cancel node drag — it will end on next mouseUp anywhere
  }

  return (
    <div className="relative w-full h-full t-deep"
      style={{
        backgroundImage: 'radial-gradient(circle, rgb(var(--brd) / 0.5) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ cursor: 'grab' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />
    </div>
  )
}
