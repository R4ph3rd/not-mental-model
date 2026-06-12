/**
 * snapshot-bridge.ts — a live, backend-free bridge between the in-browser graph
 * and the on-disk snapshot.json that the MCP / HTTP server reads.
 *
 * Today, connecting the graph to an agent is a manual dance: export a snapshot,
 * point the server at it, and re-import whenever the agent writes something back.
 * The File System Access API lets us hold a persistent handle to that very file
 * and keep it in sync automatically — the agent always reads fresh memory, and
 * agent-written nodes flow back into the app for review. No server of our own.
 *
 * Chromium-only (Chrome / Edge / Brave / Arc / Opera). Gracefully unsupported
 * elsewhere — the manual download path in the Connect modal remains the fallback.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MentalModelNode } from '@/types/mental-model'

// ── Feature detection ────────────────────────────────────────────────────────

export function isFsBridgeSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

// ── IndexedDB: persist the FileSystemFileHandle across reloads ────────────────
// File handles are structured-cloneable, so they survive in IndexedDB. localStorage
// can only hold strings, which is why we need IDB here.

const DB_NAME = 'mm-bridge'
const STORE   = 'handles'
const KEY     = 'snapshot'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror   = () => reject(req.error)
  }))
}

function idbSet(key: string, val: unknown): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(val, key)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  }))
}

function idbDel(key: string): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  }))
}

// ── File System Access API wrappers ──────────────────────────────────────────
// The permission methods (queryPermission / requestPermission) and showSaveFilePicker
// are not yet in the standard lib.dom types, so we narrow with a local shape.

type PermState = 'granted' | 'denied' | 'prompt'
interface FsHandleExt {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>
}

async function verifyPermission(handle: FsHandleExt, write: boolean): Promise<boolean> {
  const opts = { mode: write ? 'readwrite' as const : 'read' as const }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  if ((await handle.requestPermission(opts)) === 'granted') return true
  return false
}

async function getStoredHandle(): Promise<FsHandleExt | null> {
  try { return (await idbGet<FsHandleExt>(KEY)) ?? null } catch { return null }
}

/** Visible-only projection — sensitive and hidden nodes never touch disk. */
function visibleForAgent(nodes: MentalModelNode[]): MentalModelNode[] {
  return nodes.filter(n => n.active !== false && !n.sensitive)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface SnapshotBridge {
  supported:  boolean
  linked:     boolean
  fileName:   string | null
  autoSync:   boolean
  syncing:    boolean
  lastSyncAt: number | null
  syncedCount: number | null
  error:      string | null
  link:    () => Promise<void>
  unlink:  () => Promise<void>
  syncNow: () => Promise<void>
  /** Reads agent-written nodes back; returns how many new ones were merged. */
  pull:    () => Promise<number>
  setAutoSync: (v: boolean) => void
}

const AUTOSYNC_KEY = 'mm-bridge-autosync'

export function useSnapshotBridge(
  nodes: MentalModelNode[],
  onPull: (incoming: MentalModelNode[]) => number,
): SnapshotBridge {
  const supported = isFsBridgeSupported()
  const handleRef = useRef<FsHandleExt | null>(null)
  const [fileName, setFileName]   = useState<string | null>(null)
  const [linked, setLinked]       = useState(false)
  const [autoSync, setAutoSyncState] = useState(() => localStorage.getItem(AUTOSYNC_KEY) === '1')
  const [syncing, setSyncing]     = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // Keep a live view of nodes for the debounced auto-sync without re-subscribing.
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // Restore a previously-linked handle on mount.
  useEffect(() => {
    if (!supported) return
    getStoredHandle().then(h => {
      if (h) { handleRef.current = h; setFileName(h.name); setLinked(true) }
    })
  }, [supported])

  const setAutoSync = useCallback((v: boolean) => {
    setAutoSyncState(v)
    localStorage.setItem(AUTOSYNC_KEY, v ? '1' : '0')
  }, [])

  const write = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    setSyncing(true); setError(null)
    try {
      if (!(await verifyPermission(handle, true))) {
        throw new Error('Write permission to the snapshot file was denied.')
      }
      const payload = visibleForAgent(nodesRef.current)
      const writable = await handle.createWritable()
      await writable.write(JSON.stringify(payload, null, 2))
      await writable.close()
      setLastSyncAt(Date.now())
      setSyncedCount(payload.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to write snapshot.')
      throw e
    } finally {
      setSyncing(false)
    }
  }, [])

  const link = useCallback(async () => {
    setError(null)
    try {
      // @ts-expect-error showSaveFilePicker is not yet in lib.dom types
      const handle = await window.showSaveFilePicker({
        suggestedName: 'mental-model-snapshot.json',
        types: [{ description: 'Snapshot JSON', accept: { 'application/json': ['.json'] } }],
      }) as FsHandleExt
      handleRef.current = handle
      await idbSet(KEY, handle)
      setFileName(handle.name); setLinked(true)
      await write()  // seed the file immediately
    } catch (e) {
      // AbortError = user dismissed the picker; not a real error
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Could not link the file.')
    }
  }, [write])

  const unlink = useCallback(async () => {
    handleRef.current = null
    setLinked(false); setFileName(null); setLastSyncAt(null); setSyncedCount(null)
    setAutoSync(false)
    await idbDel(KEY).catch(() => {})
  }, [setAutoSync])

  const syncNow = useCallback(async () => { await write().catch(() => {}) }, [write])

  const pull = useCallback(async (): Promise<number> => {
    const handle = handleRef.current
    if (!handle) return 0
    setError(null)
    try {
      if (!(await verifyPermission(handle, false))) {
        throw new Error('Read permission to the snapshot file was denied.')
      }
      const file = await handle.getFile()
      const text = await file.text()
      if (!text.trim()) return 0
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return 0
      return onPull(data as MentalModelNode[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read snapshot.')
      return 0
    }
  }, [onPull])

  // Auto-sync: debounce writes whenever the graph changes while enabled.
  useEffect(() => {
    if (!autoSync || !linked) return
    const t = setTimeout(() => { void write() }, 800)
    return () => clearTimeout(t)
  }, [nodes, autoSync, linked, write])

  return {
    supported, linked, fileName, autoSync, syncing, lastSyncAt, syncedCount, error,
    link, unlink, syncNow, pull, setAutoSync,
  }
}
