// Canonical LLM prompts shared across the app.
// Single source of truth — import from here, never define inline.

/**
 * Extract persistent knowledge nodes from conversation text or a chat exchange.
 * Used by: ChatPanel (per-exchange extraction), ClaudeSync (bulk import).
 */
export const EXTRACT_SYSTEM = `You extract structured knowledge from text to build a mental model of the user.

Extract facts, preferences, skills, goals, projects, and conversation topics.
Return ONLY a valid JSON array with no markdown fences:
[{
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label (max 60 chars)",
  "content": "detailed description (1-3 sentences)",
  "tags": ["tag1", "tag2"],
  "confidence": "high"|"medium"|"low",
  "memoryType": "episodic"|"semantic",
  "scope": "Work"|"Personal"|"Skills"|"Goals"|"Research"|"Side projects"|"",
  "importance": 0.8
}]

Guidelines:
- episodic = tied to a specific event/conversation; semantic = general lasting knowledge
- importance: 1.0 for critical facts, 0.5 for minor details
- Extract only genuinely new, lasting information. Max 5 items per call.
- Be concise. Do not invent information not present in the text.
- If nothing memorable, return [].`

/**
 * Convert a raw AI memory export (bullet list from Claude.ai / ChatGPT) into nodes.
 * Used by: ClaudeSync (memory-import tab).
 */
export const MEMORY_IMPORT_SYSTEM = `You convert a raw list of AI memory bullet points into structured knowledge nodes.

The input is a list of memories as shown in an AI assistant's settings page (e.g. "• User prefers dark themes").
Return ONLY a valid JSON array with no markdown fences:
[{
  "category": "project"|"conversation"|"fact"|"preference"|"goal"|"skill",
  "title": "short label (max 60 chars)",
  "content": "expanded description (1-2 sentences)",
  "tags": ["tag1"],
  "confidence": "high"|"medium"|"low",
  "memoryType": "episodic"|"semantic",
  "scope": "Work"|"Personal"|"Skills"|"Goals"|"",
  "importance": 0.85
}]

Guidelines:
- Most memories are semantic (general facts about the person)
- Group related bullet points into one node when they clearly belong together
- Infer the best category: preferences → "preference", skills → "skill", ongoing work → "project", etc.`

/**
 * Synthesize multiple nodes into one consolidated semantic node.
 * Used by: ClaudeSync (summarize tab).
 */
export const SUMMARIZE_SYSTEM = `You synthesize multiple memory nodes into a single concise semantic memory. Return ONLY a JSON object with no markdown fences:
{
  "title": "concise label",
  "content": "synthesized insight combining all nodes",
  "tags": ["relevant", "tags"],
  "scope": "scope name or empty string"
}`
