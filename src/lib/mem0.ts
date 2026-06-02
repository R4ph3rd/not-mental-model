const BASE = 'https://api.mem0.ai/v1'

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` }
}

export interface Mem0Memory {
  id: string
  memory: string
  user_id: string
  score?: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Mem0Config {
  apiKey: string
  userId: string
}

export function getMem0Config(): Mem0Config | null {
  const apiKey = localStorage.getItem('mm-mem0-key') ?? ''
  const userId = localStorage.getItem('mm-mem0-user') ?? ''
  if (!apiKey || !userId) return null
  return { apiKey, userId }
}

export async function mem0GetAll(apiKey: string, userId: string): Promise<Mem0Memory[]> {
  const res = await fetch(`${BASE}/memories/?user_id=${encodeURIComponent(userId)}`, {
    headers: headers(apiKey),
  })
  if (!res.ok) throw new Error(`Mem0 ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

export async function mem0Search(
  apiKey: string,
  userId: string,
  query: string,
  limit = 8,
): Promise<Mem0Memory[]> {
  const res = await fetch(`${BASE}/memories/search/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ query, user_id: userId, limit }),
  })
  if (!res.ok) throw new Error(`Mem0 search ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

/**
 * Add a single fact/memory. Returns the mem0 memory ID on success (null if
 * mem0 merged it into an existing memory without returning a new ID).
 */
export async function mem0AddMemory(
  apiKey: string,
  userId: string,
  text: string,
  metadata?: Record<string, unknown>,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    messages: [{ role: 'user', content: text }],
    user_id: userId,
  }
  if (metadata) body.metadata = metadata
  const res = await fetch(`${BASE}/memories/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Mem0 add ${res.status}`)
  const data = await res.json()
  // Response shape: { results: [{ id, memory, event: 'ADD'|'UPDATE'|'DELETE' }] }
  const results = (data.results ?? data) as Array<{ id?: string; event?: string }>
  const relevant = results.find(r => r.event === 'ADD' || r.event === 'UPDATE')
  return relevant?.id ?? null
}

/**
 * Add a conversation exchange to mem0 (used by chat after each turn).
 */
export async function mem0Add(
  apiKey: string,
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  const res = await fetch(`${BASE}/memories/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ messages, user_id: userId }),
  })
  if (!res.ok) throw new Error(`Mem0 add ${res.status}`)
}

/**
 * Update the text of an existing mem0 memory by its ID.
 */
export async function mem0Update(apiKey: string, memoryId: string, text: string): Promise<void> {
  const res = await fetch(`${BASE}/memories/${memoryId}/`, {
    method: 'PUT',
    headers: headers(apiKey),
    body: JSON.stringify({ text }),
  })
  // 404 means it was already deleted/merged — treat as non-fatal
  if (!res.ok && res.status !== 404) throw new Error(`Mem0 update ${res.status}`)
}

export async function mem0Delete(apiKey: string, memoryId: string): Promise<void> {
  await fetch(`${BASE}/memories/${memoryId}/`, {
    method: 'DELETE',
    headers: headers(apiKey),
  })
}
