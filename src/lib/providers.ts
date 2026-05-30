export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'ollama'

export interface ProviderModel {
  id: string
  label: string
}

export interface Provider {
  id: ProviderId
  name: string
  models: ProviderModel[]
  keyPlaceholder: string
  keyLabel: string
  requiresKey: boolean
  baseUrl?: string
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyLabel: 'Anthropic API key',
    requiresKey: true,
  },
  {
    id: 'openai',
    name: 'GPT (OpenAI)',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'o3', label: 'o3' },
    ],
    keyPlaceholder: 'sk-...',
    keyLabel: 'OpenAI API key',
    requiresKey: true,
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    keyPlaceholder: 'AIza...',
    keyLabel: 'Google AI API key',
    requiresKey: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral-medium-latest', label: 'Mistral Medium' },
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'devstral-small-latest', label: 'Devstral Small' },
    ],
    keyPlaceholder: 'API key...',
    keyLabel: 'Mistral API key',
    requiresKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    models: [
      { id: 'llama3.3', label: 'Llama 3.3' },
      { id: 'mistral', label: 'Mistral' },
      { id: 'phi4', label: 'Phi-4' },
      { id: 'gemma3', label: 'Gemma 3' },
    ],
    keyPlaceholder: 'No key needed',
    keyLabel: 'Base URL',
    requiresKey: false,
    baseUrl: 'http://localhost:11434',
  },
]

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0]
}

export const STORAGE_KEYS = {
  provider: 'mm-provider',
  model: (id: ProviderId) => `mm-model-${id}`,
  key: (id: ProviderId) => `mm-key-${id}`,
}

// ─── API adapters ────────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, model: string, system: string, userMsg: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: userMsg }] }),
  })
  await assertOk(res)
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find(c => c.type === 'text')?.text ?? ''
}

async function callOpenAICompat(baseUrl: string, apiKey: string, model: string, system: string, userMsg: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
    }),
  })
  await assertOk(res)
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
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      }),
    }
  )
  await assertOk(res)
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  return data.candidates[0]?.content.parts[0]?.text ?? ''
}

async function assertOk(res: Response) {
  if (res.ok) return
  const err = await res.json().catch(() => ({})) as { error?: { message?: string }; message?: string }
  throw new Error(err.error?.message ?? err.message ?? `HTTP ${res.status}`)
}

export async function callProvider(
  providerId: ProviderId,
  apiKey: string,
  model: string,
  system: string,
  userMsg: string,
): Promise<string> {
  switch (providerId) {
    case 'anthropic':
      return callAnthropic(apiKey, model, system, userMsg)
    case 'openai':
      return callOpenAICompat('https://api.openai.com', apiKey, model, system, userMsg)
    case 'gemini':
      return callGemini(apiKey, model, system, userMsg)
    case 'mistral':
      return callOpenAICompat('https://api.mistral.ai', apiKey, model, system, userMsg)
    case 'ollama':
      return callOpenAICompat(apiKey || 'http://localhost:11434', '', model, system, userMsg)
  }
}
