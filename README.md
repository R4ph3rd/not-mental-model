# Not-a-mental-model

> A visual, editable knowledge graph for your AI agent's memory.

Instead of AI memory being an opaque black box, every piece of knowledge the agent holds about you is a **card** you can inspect, edit, rate, tag, link, decay, and remove. Built for researchers, power users, and anyone who wants real control over persistent AI agents.

**Live demo:** https://r4ph3rd.github.io/not-mental-model/

---

## Quick start

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production build
```

On first open, choose **Start with template** to explore the demo graph, or **Import** to extract memories from your own conversations.

---

## Screenshots

| Canvas view | Grid view | Timeline view |
|---|---|---|
| ![Canvas](./docs/screenshots/canvas.png) | ![Grid](./docs/screenshots/grid.png) | ![Timeline](./docs/screenshots/timeline.png) |

| Inspector panel | Chat panel | Graph view |
|---|---|---|
| ![Inspector](./docs/screenshots/inspector.png) | ![Chat](./docs/screenshots/chat.png) | ![Graph](./docs/screenshots/graph.png) |

---

## Core concepts

### Node

A node is one unit of knowledge. Every node has:

| Field | Description |
|---|---|
| **Category** | `project` · `conversation` · `fact` · `preference` · `goal` · `skill` |
| **Memory type** | `semantic` (abstracted, lasting fact) · `episodic` (specific event) |
| **Confidence** | `high` · `medium` · `low` — affects retention strength |
| **Importance** | 0–100% slider — agent-specified utility weight |
| **Scope** | Domain grouping: Work · Personal · Skills · Goals · Research · Side projects |
| **Source** | How the memory was created: `direct` · `conversation` · `observed` · `inferred` · `claude.ai` · `chatgpt` |
| **Provenance** | `user` (manually added) · `extracted` (AI-extracted) · `agent` (auto-inferred, requires confirmation) |
| **Sensitive** | 🔑 key — excluded from agent context and copy-to-clipboard exports |
| **Tags** | Free-form labels for cross-cutting themes |
| **Linked nodes** | Semantic links to related memories |

### Retention score (decay model)

Every node shows a live **R:** score computed from three factors (Xu 2025):

```
R = recency × 0.4 + importance × 0.35 + confidence × 0.25
recency = max(0, 1 − daysSinceLastTouched / 90)
```

| Label | Score | Bar colour |
|---|---|---|
| **strong** | ≥ 75% | green |
| **stable** | ≥ 50% | blue |
| **fading** | ≥ 25% | yellow |
| **stale**  | < 25% | red |

Pinned nodes always stay at 100%.

---

## Views

### Canvas

Spatial map of all nodes, clustered by category, with lines drawn between linked memories.

- **Drag** a node to reposition (layout persists in localStorage)
- **Scroll** to zoom · **drag background** to pan
- **Click** a node to open its inspector
- **Ctrl/Cmd + click** to multi-select
- Card titles wrap fully — no truncation, long titles expand card height
- Three-dots menu floats above the title with a dark bg pill
- Sensitive / pin / eye icons animate in from the right on card hover

### Graph

Force-directed graph with group blobs.

- Groups enclosed by a smooth closed-bézier hull with 72 px padding — all nodes stay inside the shape
- Group label sits inside the top edge of the blob
- Center-attraction force reduced (0.001); simulation restarts after drag

### Grid

Dense card layout. Each card shows a colored category header bar, title, content, tags, linked nodes, provenance badges, and the retention bar.

- **Inline editing:** double-click the title or content text to edit directly on the card
- Groups separated by a horizontal divider rule
- Yellow left border on unconfirmed-agent cards persists on hover
- Card icon buttons slide in from the right

### Timeline

Chronological feed grouped by date, newest first. Each row shows time, category icon, title, confidence dot, provenance icons, and a mini retention bar.

---

## Inspector panel

Click any node to open its inspector on the right side.

- Full edit form: category, memory type, confidence, scope, source, importance slider, tags
- **In conversations** — shows all conversations the node is linked to; add/remove
- **Live dedup hint** — while you're editing the title, a debounced similarity check runs in the background. If a probable duplicate is found a yellow callout appears with **Show me** (zooms to the other node) or **Decline**
- **Similar nodes section** — above the action icons, every node with a Jaccard title-similarity ≥ 35% is listed with four inline actions per match:
  - **Zoom** (🔍) — focus canvas on the similar node
  - **AI merge** (↔) — calls the LLM to merge the two nodes; shows a preview with Apply / Cancel
  - **Diff** (⇄) — side-by-side comparison panel
  - **Delete other** (🗑) — deletes the similar node without closing the current inspector
- Title area expands vertically; wraps instead of truncating
- Confidence pill shows a colored dot + colored text per level (green / yellow / red)
- All pill dropdowns right-aligned so they don't overflow the panel edge
- Agent confirmation strip uses amber bg + border style, with compact Keep / Discard buttons
- Delete is ghost-style (icon + red text)

---

## Memory management

### Visibility toggle

**Eye icon** on every card — hides a node from the agent (`active: false`) without deleting it. Hidden nodes are greyed out and excluded from all context injections.

### Sensitive flag

**Key icon** — marks a node as private. Sensitive nodes are excluded from:
- Agent chat context injection
- Copy-to-clipboard context export
- Memory group bulk enables

> **Threat model note:** `sensitive` is a visibility filter, not encryption. Sensitive node content is still plaintext in `localStorage` and in exported JSON. See the [Security / threat model](#security--threat-model) section.

### Pinning

**Pin icon** — protects a node from decay. Pinned nodes hold full retention strength and cannot be distilled.

### Distil episodic → semantic

On any **episodic** node with R < 50% (and not pinned), a **Distil →** link appears next to the retention bar. Clicking it:
1. Calls the LLM
2. Extracts the key reusable insight
3. Creates a new `semantic` node with `provenance: extracted`
4. Deactivates the original episodic node

### Stale review panel

Click the amber **stale badge** in the top bar (appears when ≥1 node has R < 25%) to open the stale review panel. Per stale node:

- **Boost** — refreshes `lastAccessedAt` to now, which resets recency decay
- **Pin** — permanently protects from decay
- **Archive** — hides the node without deleting it

**Archive all** and **Boost all** buttons act on every listed node at once.

### Confirm / discard agent nodes

Nodes with `provenance: agent` and `confirmed: false` show an amber left border and an inline strip:
- **Keep** — confirms the node
- **Discard** — deletes it

These appear after chat auto-extraction or any Infer operation.

---

## Organization

### Projects → Conversations hierarchy

The left sidebar shows a collapsible tree:

```
▼ Work
    Sprint retro — Q4
    Design system: button variants
▼ Personal
    Morning routine experiment
Learning
    Rust: ownership + lifetimes
```

Click a project to filter all views. Click a conversation to filter to that conversation. A node can belong to **multiple conversations** — manage this in the inspector.

### Memory groups

Below projects, **groups** provide orthogonal organization (e.g. "Work context", "Creative projects").

- Click a group label to filter the view
- **Eye icon on group** — bulk toggle: suspends the entire group from agent context without changing individual active flags
- **+** to add a new group · groups persist in localStorage

---

## AI features

### Import / Extract with deduplication

The **Import / Extract** button (folder icon) opens a dialog with three tabs:

**Extract** — paste any conversation text. The LLM parses it into structured nodes.

**Memory import** — paste a Claude.ai / ChatGPT memory export, or a raw JSON array of nodes.

**Summarize** — select 2+ nodes and distil them into one consolidated semantic node.

Before any import is applied, incoming nodes are run through the dedup pipeline:

- **Jaccard title similarity** — tokenises titles (words > 2 chars), computes set overlap
  - ≥ 65% similarity → flagged as **likely duplicate**
  - 35–65% → flagged as **possible conflict**
- **Clean nodes** (no matches) are imported automatically
- **Flagged nodes** open the **Dedup Review modal** — a side-by-side comparison for each match with four choices per node:
  - **Merge (AI)** — calls the LLM to synthesise both nodes; shows a merged preview before committing
  - **Keep both** — adds the incoming node alongside the existing one
  - **Replace existing** — overwrites the existing node with the incoming one
  - **Skip** — discards the incoming node
- For **possible conflict** matches, an optional **Check contradiction (AI)** button runs a yes/no LLM call and upgrades the badge to **Contradiction confirmed** if the nodes disagree

---

### Chat with memory context

Click **Chat** in the topbar.

- **Context injection** — active, non-sensitive, non-group-disabled nodes are injected as background for every message. The header shows how many nodes are in the current context window (respects active group/conversation/category filters)
- **Mem0 integration** — if configured, recalls from Mem0 semantically and saves back after each exchange
- **Recall transparency** — expand "X memories recalled" under each assistant reply to see exactly which nodes were used (with links back to node titles)
- **Auto-extraction** — after each exchange the LLM extracts key facts as unconfirmed agent nodes (amber, require confirmation); a badge shows "N nodes extracted"
- **Pause memorization** (⏸) — disables Mem0 sync and auto-extraction for the current session

---

### Infer from selection

Select **2 or more nodes**, then click **Infer** in the bottom bar. The LLM analyses the combination and generates 3–6 **inference candidates** — facts, goals, or preferences that likely follow from the selected nodes. A picker modal lets you review each candidate (title, content, confidence, reasoning) and choose which to add. Added nodes get `provenance: agent, confirmed: false`.

---

### Exploratory inference

Click the **Explore** button (telescope icon) in the topbar. Two modes:

**Infer hidden facts** — the LLM analyses your entire active knowledge base and predicts facts, skills, or preferences that are probably true but not yet recorded. Each candidate shows a confidence score and reasoning.

**Suggest relevant knowledge** — the LLM suggests skills to learn, topics to explore, or goals to articulate based on your profile.

Both produce a selectable list — picked items are added as unconfirmed agent nodes.

---

### Copy context to clipboard

The **clipboard icon** copies all active, non-sensitive nodes visible in the current view as a structured Markdown block:

```markdown
## My context — June 1, 2025

### Skills
- **Figma — expert**: Uses Figma as primary design tool…

### Goals
- **Ship Palette v1 by summer**: Palette is a side project…
```

The badge next to the icon always shows the count of nodes in the current view.

- When a filter (group, conversation, category, search) is active, a popover appears showing which filter is in effect
- **Include agent instruction** checkbox (opt-in) appends a line asking the recipient to update their memory — only enable for agents with write access

---

### MCP server export

Click the **Server** icon in the topbar to open the **Connect to agents** dialog.

1. Download `mental-model-mcp.js` (Node.js MCP server) and your current snapshot JSON
2. Add the generated config block to `claude_desktop_config.json` or `.mcp.json`
3. Re-export the snapshot whenever your graph changes

**Available MCP tools:**

| Tool | Signature | Description |
|---|---|---|
| `memory_search` | `query, limit?, category?` | Semantic search over your graph |
| `memory_get_context` | `scope?, category?, limit?` | Full context block, optionally scoped |

---

## Settings

Open **Settings** (gear icon) to configure:
- AI provider API keys (Groq · Gemini · Cerebras · Claude · OpenAI · Mistral · Ollama local)
- Mem0 API key and user ID for live sync
- Theme

---

## Provider support

| Provider | Free tier | Key format |
|---|---|---|
| **Groq** | ✅ | `gsk_…` |
| **Gemini** | ✅ | `AIza…` |
| **Cerebras** | ✅ | `csk-…` |
| **Ollama (local)** | ✅ | URL only |
| **Claude (Anthropic)** | ❌ | `sk-ant-…` |
| **OpenAI** | ❌ | `sk-…` |
| **Mistral** | ❌ | `…` |

---

## Security / threat model

This is a **client-only app with no backend**. Understanding the security boundaries:

**What is protected:**
- No data is sent to any server except the AI provider you explicitly configure
- Sensitive-flagged nodes are excluded from context exports and clipboard copies

**What is NOT protected:**

- **`sensitive` is a visibility filter, not encryption.** Sensitive node content is stored in plaintext in `localStorage` under `mental-model-nodes` and is included in any raw JSON export. Any JavaScript running on the page — including browser extensions or an injected script — can read it. If you store genuinely private information, do not rely on the sensitive flag alone.
- **All provider API keys are plaintext in `localStorage`.** This is standard for client-only apps, but combined with direct browser-to-provider API calls, a single XSS or malicious npm dependency could exfiltrate every key. The README's privacy claim ("never sent anywhere except the provider") is accurate for this codebase; it does not cover supply-chain attacks or compromised extensions.
- **The export JSON is plaintext.** `mental-model-snapshot.json` contains all non-sensitive active nodes in clear text. Treat it like any credentials file.

**Recommended mitigations (not yet implemented — see roadmap):**
- Encrypt sensitive node content at rest with a user-supplied passphrase (WebCrypto `PBKDF2` → `AES-GCM`; never persist the derived key)
- Use a backend session token instead of persisting raw API keys in storage
- Add a Content Security Policy header to the deployment

---

## Keyboard & interaction reference

| Action | How |
|---|---|
| Open inspector | Single-click on a card |
| Edit title / content inline | Double-click on the text field |
| Multi-select nodes | Ctrl/Cmd + click |
| Pan canvas | Drag the background |
| Zoom canvas | Scroll wheel |
| Confirm inline edit | Enter (single-line) |
| Cancel inline edit | Escape |

---

## Research grounding

| Paper | Contribution |
|---|---|
| **Memory Sandbox** (Huang et al., UIST 2023) | Editable-memory framing, visibility toggle, cross-conversation sharing |
| **Users' Expectations with Agent Memory** (CHI 2025) | Scope/project hierarchy, memory groups with bulk enable/disable |
| **AI Memory Governance** (2024) | Provenance labelling, unconfirmed agent nodes, sensitive flag, pause-memorization |
| **Memory Management for Long-Running Agents** (Xu, 2025) | Episodic/semantic split, importance-weighted decay, distillation, timeline view |

---

## Tech stack

- **React 19 + TypeScript** · Vite
- **Tailwind CSS v4** · custom dark theme via CSS variables
- **shadcn/ui-style** components (Radix primitives)
- **React Flow** · canvas graph
- **Lucide React** · icons
- `localStorage` · all persistence (no backend required)

---

## Roadmap to production-readiness

This section lists the gaps between the current prototype and a production-ready product. Roughly ordered by impact.

### 1. Security hardening

- [ ] **Encrypt sensitive nodes at rest.** Derive an `AES-GCM` key from a user passphrase via `PBKDF2` (WebCrypto); encrypt `content` of sensitive nodes before writing to storage; never persist the derived key. Show a passphrase prompt on first load if any sensitive nodes exist.
- [ ] **Stop persisting raw API keys in localStorage.** Proxy AI calls through a thin backend that holds the key server-side; issue a short-lived session token to the browser instead. Alternatively, prompt for the key on each session and keep it only in memory.
- [ ] **Add a Content Security Policy** (`default-src 'self'`; explicit allowlist for each provider domain) to the deployment to contain XSS and supply-chain injection.
- [ ] **Audit npm dependencies.** Run `npm audit` in CI; add `socket.dev` or similar supply-chain scanning. The number of transitive dependencies is the real attack surface for key exfiltration.
- [ ] **Honest docs.** The current README already acknowledges the threat model (above). Keep it updated as mitigations land.

### 2. Persistence and sync

- [ ] **Backend persistence / sync.** `localStorage` is wiped by browser data clearing, scoped to the origin, and capped at ~5 MB. A real product needs a server-side store (e.g. Supabase, PocketBase, a lightweight API) with per-user auth and encrypted transport.
- [ ] **Conflict-free merge / multi-device sync.** If a user edits on two devices, changes silently overwrite each other. Adopt a CRDT (e.g. `automerge`, `yjs`) or a last-write-wins log with a server-assigned vector clock.
- [ ] **Export versioning and migration.** The JSON export format has no schema version field. Any future change to `MentalModelNode` fields will silently break existing exports. Add a `schemaVersion` field and write a migration path for each change.
- [ ] **Import from more sources.** Native importers for ChatGPT memory export format, Notion pages, Obsidian vaults, plain-text notes.

### 3. Search and retrieval

- [ ] **Semantic search.** The current search is exact substring matching on title + content. Replace or augment with a client-side vector index (e.g. `@xenova/transformers` with an all-MiniLM embedding model) so that "running" matches "marathon training" and "jogging".
- [ ] **Full-text index.** Even without vectors, `lunr.js` or `flexsearch` would give stemming, relevance ranking, and field weighting for free.
- [ ] **Filter memory.** The dedup pipeline uses Jaccard title similarity. An embedding-based nearest-neighbour search would catch paraphrases ("I prefer dark mode" ↔ "dark theme is my default") that share no word tokens.

### 4. AI quality and reliability

- [ ] **Structured output / tool use.** The extraction and inference prompts currently parse free-form JSON from the model. Migrate to provider-native structured output (`response_format: { type: "json_schema" }` on OpenAI, `tool_use` on Anthropic) to eliminate parse failures and hallucinated fields.
- [ ] **Extraction quality.** The extract-from-conversation prompt produces variable-quality nodes. Add a second-pass validation step that scores each candidate for specificity, groundedness, and non-redundancy before presenting it to the user.
- [ ] **Model selection per task.** Not all operations need a frontier model. Conflict checking and dedup can run on a cheap/local model; extraction and merge can use a stronger one. Expose per-feature model overrides in Settings.
- [ ] **Token budget management.** For large knowledge bases, full-context injection in chat will exceed model context windows silently. Add a token counter and truncate / summarise the injected context when it approaches the limit.
- [ ] **Rate limiting and error recovery.** API calls have no retry logic, backoff, or per-minute quota guard. Multiple simultaneous AI operations (e.g. import + dedup on a large file) can 429 the provider silently.

### 5. Knowledge graph quality

- [ ] **Automated link suggestion.** After adding or editing a node, suggest semantically related nodes to link it to (currently links are entirely manual).
- [ ] **Graph integrity checks.** Detect and surface orphan nodes (no links, no conversation, low recency), circular reasoning, or contradictions that slipped past the dedup check.
- [ ] **Decay notifications.** Surface a "you have N nodes going stale this week" nudge on load rather than requiring the user to open the stale review panel manually.
- [ ] **Batch distillation.** Allow selecting multiple fading episodic nodes and distilling them into a single summary semantic node in one operation.
- [ ] **Node history / versioning.** Show a changelog for each node — what changed, when, and from which provenance. Required for trust in an agent-written knowledge base.

### 6. UX and accessibility

- [ ] **Undo / redo.** Destructive operations (delete, archive, replace) have no undo. A command stack (zustand `temporal` middleware or a simple action log) would be a high-trust multiplier.
- [ ] **Keyboard navigation.** The app is almost entirely mouse-driven. Add keyboard shortcuts for common operations: open inspector (`Enter`), delete (`Delete`/`Backspace`), next/previous node (`Tab`), etc.
- [ ] **Accessibility audit.** Radix primitives handle most ARIA roles, but custom canvas elements (the drag-and-drop graph), custom badges, and inline-edit patterns need manual audit for screen-reader compatibility and focus management.
- [ ] **Mobile / touch.** The canvas and grid are unusable on mobile screens. Either add a responsive layout or clearly document desktop-only.
- [ ] **Onboarding improvements.** The template data covers all decay stages and node types, but there is no guided tour that explains the decay model, the confirm/discard flow, or the dedup pipeline to new users.

### 7. Collaboration

- [ ] **Shared graphs.** Allow read or read/write access to a graph for a team (e.g. shared project context for an engineering team's agent).
- [ ] **Comment / annotation.** Let collaborators annotate nodes without editing them — useful for flagging uncertain memories or disputed facts.
- [ ] **Audit log.** For shared graphs, log who changed what and when.

### 8. Agent integration

- [ ] **Live MCP sync.** Currently the MCP server reads a static snapshot file. A live WebSocket or polling endpoint would let the agent always see the latest graph state without manual re-export.
- [ ] **Write-back from agent.** Allow the MCP server to propose new nodes back to the UI (currently MCP is read-only). Proposals land as unconfirmed agent nodes, matching the existing confirmation UX.
- [ ] **Scoped context injection.** Let the agent request context filtered by category, scope, or conversation — not just the full graph dump.
- [ ] **OpenAI Assistants / function calling integration.** Expose the graph as a retrieval function for the Assistants API, not just MCP.

### 9. Operations

- [ ] **Automated tests.** There are no unit or integration tests. At minimum: decay score calculations, Jaccard similarity, classifyIncoming edge cases, and the dedup merge flow should be covered.
- [ ] **CI.** Add a GitHub Actions workflow: typecheck (`tsc --noEmit`), lint, build, test.
- [ ] **Analytics / telemetry.** For a deployed product, understand which features are used, which operations fail, and what the typical graph size is — without logging raw node content.
- [ ] **Rate-limited public demo.** The live demo uses the visitor's own API keys. Consider a rate-limited Groq or Gemini proxy key for the demo so visitors can try AI features without configuring anything.

---

## License

MIT
