export interface ProviderConfig {
  id: string
  label: string
  storageKey: string
  baseUrl?: string
  defaultModel: string
  free: boolean
  type: 'anthropic' | 'openai-compat' | 'gemini' | 'ollama'
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'groq',
    label: 'Groq',
    storageKey: 'mm-groq-key',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    free: true,
    type: 'openai-compat',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    storageKey: 'mm-gemini-key',
    defaultModel: 'gemini-1.5-flash',
    free: true,
    type: 'gemini',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    storageKey: 'mm-cerebras-key',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama3.1-8b',
    free: true,
    type: 'openai-compat',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    storageKey: 'mm-ollama-url',
    defaultModel: 'llama3.2',
    free: true,
    type: 'ollama',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    storageKey: 'mm-claude-key',
    defaultModel: 'claude-haiku-4-5-20251001',
    free: false,
    type: 'anthropic',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    storageKey: 'mm-openai-key',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    free: false,
    type: 'openai-compat',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    storageKey: 'mm-mistral-key',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    free: false,
    type: 'openai-compat',
  },
]

async function callAnthropic(apiKey: string, model: string, system: string, userMsg: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: userMsg }] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Anthropic error ${res.status}`)
  }
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find(c => c.type === 'text')?.text ?? ''
}

async function callOpenAICompat(baseUrl: string, apiKey: string, model: string, system: string, userMsg: string): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `API error ${res.status}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function callGemini(apiKey: string, model: string, system: string, userMsg: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: userMsg }] }],
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Gemini error ${res.status}`)
  }
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  return data.candidates[0]?.content?.parts[0]?.text ?? ''
}

export async function callProvider(providerId: string, system: string, userMsg: string): Promise<string> {
  const cfg = PROVIDER_CONFIGS.find(p => p.id === providerId)
  if (!cfg) throw new Error(`Unknown provider: ${providerId}`)

  if (cfg.type === 'ollama') {
    const base = (localStorage.getItem('mm-ollama-url') || 'http://localhost:11434') + '/v1'
    return callOpenAICompat(base, 'ollama', cfg.defaultModel, system, userMsg)
  }

  const key = localStorage.getItem(cfg.storageKey) ?? ''
  if (!key) throw new Error(`No API key configured for ${cfg.label}. Add it in Settings.`)

  if (cfg.type === 'anthropic') return callAnthropic(key, cfg.defaultModel, system, userMsg)
  if (cfg.type === 'gemini')   return callGemini(key, cfg.defaultModel, system, userMsg)
  if (cfg.type === 'openai-compat' && cfg.baseUrl) return callOpenAICompat(cfg.baseUrl, key, cfg.defaultModel, system, userMsg)

  throw new Error(`Provider ${providerId} misconfigured`)
}

/** Returns the first provider that has a key set, preferring free ones. */
export function getDefaultProvider(): string {
  for (const p of PROVIDER_CONFIGS) {
    if (p.type === 'ollama') continue // skip ollama as auto-default
    if (localStorage.getItem(p.storageKey)) return p.id
  }
  return 'groq'
}
