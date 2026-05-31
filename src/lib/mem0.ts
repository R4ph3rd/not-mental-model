const BASE = 'https://api.mem0.ai/v1'

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', Authorization: `Token ${apiKey}` }
}

export interface Mem0Memory {
  id: string
  memory: string
  user_id: string
  created_at: string
  updated_at: string
}

export function getMem0Config(): { apiKey: string; userId: string } | null {
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

export async function mem0Search(apiKey: string, userId: string, query: string): Promise<Mem0Memory[]> {
  const res = await fetch(`${BASE}/memories/search/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ query, user_id: userId, limit: 8 }),
  })
  if (!res.ok) throw new Error(`Mem0 search ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.results ?? [])
}

export async function mem0Add(
  apiKey: string,
  userId: string,
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  const res = await fetch(`${BASE}/memories/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ messages, user_id: userId }),
  })
  if (!res.ok) throw new Error(`Mem0 add ${res.status}`)
}

export async function mem0Delete(apiKey: string, memoryId: string): Promise<void> {
  await fetch(`${BASE}/memories/${memoryId}/`, {
    method: 'DELETE',
    headers: headers(apiKey),
  })
}
