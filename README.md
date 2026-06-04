# Not-a-mental-model

> A visual, editable knowledge graph for your AI agent's memory.

Instead of AI memory being an opaque black box, every piece of knowledge the agent holds about you is a **card** you can inspect, edit, rate, tag, link, decay, and remove. Built for researchers, power users, and anyone who wants real control over persistent AI agents.

**Live demo:** https://r4ph3rd.github.io/not-mental-model/

---

## What's new

### UI polish (June 2025)

**Canvas**
- Card titles wrap fully (no truncation); long titles expand card height
- Three-dots menu floats above title text with a dark bg pill
- Sensitive (🔑) / pin / eye icons animate in from the right on card hover with no gap between them
- Menu closes on outside click (fixed CSS transform stacking context bug)

**Inspector**
- Title area expands vertically; wraps instead of truncating
- Confidence pill shows a colored dot + colored text per level (green / yellow / red)
- All pill dropdowns right-aligned so they don't overflow the panel edge
- Agent confirmation strip now uses the same amber bg + border style as the grid card, with compact Keep / Discard buttons
- Delete is ghost-style (icon + red text, no filled border)
- Lock icon changed to a key icon (less visually heavy when filled)

**Grid view**
- Groups separated by a horizontal divider rule — no more boxes
- Yellow left border on unconfirmed-agent cards persists on hover
- Card icon buttons slide in from the right with a translate animation; no spacing between icons

**Graph view**
- Groups enclosed by a smooth closed-bézier hull with 72 px padding — all nodes stay inside the shape
- Group label now sits just inside the top edge of the blob (was floating above it)
- Center-attraction force reduced (0.001); simulation restarts after drag

**Timeline view**
- Vertical track line removed
- R retention label shown only for the first (most-recent) date group
- Subtle light background on item hover

**Hierarchy sidebar**
- Conversations shown under a collapsible **CONVERSATIONS** header per group
- All nodes shown flat at the group root — not nested inside conversation items
- Clicking a node in the sidebar opens the inspector

**Other**
- `BookOpen` icon for Fact nodes, `Briefcase` for Project nodes
- All buttons / links have `cursor: pointer`
- Conversation-linked nodes have a violet left border; unconfirmed agent nodes have amber

---

## Screenshots

<!-- Add screenshots to docs/screenshots/ and push — placeholders below -->

| Canvas view | Grid view | Timeline view |
|---|---|---|
| ![Canvas](./docs/screenshots/canvas.png) | ![Grid](./docs/screenshots/grid.png) | ![Timeline](./docs/screenshots/timeline.png) |

| Inspector panel | Chat panel | Onboarding |
|---|---|---|
| ![Inspector](./docs/screenshots/inspector.png) | ![Chat](./docs/screenshots/chat.png) | ![Onboarding](./docs/screenshots/onboarding.png) |

---

## Quick start

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production build
```

On first open, choose **Start with template** to explore the demo graph, or **Import** to extract memories from your own conversations.

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
| **Sensitive** | 🔒 lock — excluded from agent context and copy-to-clipboard exports |
| **Tags** | Free-form labels for cross-cutting themes |
| **Linked nodes** | Semantic links to related memories |

### Retention score (decay model)

Every node shows a live **R:** score:

```
R = recency × 0.4 + importance × 0.35 + confidence × 0.25
```

Labels: **strong** (≥75%) · **stable** (≥50%) · **fading** (≥25%) · **stale** (<25%)

Pinned nodes always stay at 100%.

---

## Views

### Canvas (graph)

<!-- ![Canvas annotated](./docs/screenshots/canvas-annotated.png) -->

Spatial map of all nodes clustered by category, with lines drawn between linked memories.

- **Drag** a node to reposition (layout persists in localStorage)
- **Scroll** to zoom · **drag background** to pan
- **Click** a node to open its inspector
- **Ctrl/Cmd + click** to multi-select

### Grid

<!-- ![Grid annotated](./docs/screenshots/grid-annotated.png) -->

Dense card layout. Each card shows a colored category header bar, title, content, tags, linked nodes, provenance badges, and the retention bar.

**Inline editing:** single-click opens the inspector. Double-click the title or content text to edit directly on the card.

### Timeline

<!-- ![Timeline annotated](./docs/screenshots/timeline-annotated.png) -->

Chronological feed grouped by date (newest first). Each row shows time, category icon, title, confidence dot, provenance icons, and a mini retention bar.

---

## Memory management

### Visibility toggle

**Eye icon** on every card — hides a node from the agent (`active: false`) without deleting it. Hidden nodes are greyed out and excluded from all context injections.

### Sensitive flag

**Lock icon** — marks a node as private. Sensitive nodes are excluded from:
- Agent chat context injection
- Copy-to-clipboard context export
- Memory group bulk enables

### Pinning

**Pin icon** — protects a node from decay. Pinned nodes hold full retention strength and cannot be distilled.

### Distil episodic → semantic

On any **episodic** node with R < 50% (and not pinned), a **Distil →** link appears next to the retention bar. Clicking it:
1. Calls the LLM
2. Extracts the key reusable insight
3. Creates a new `semantic` node with `provenance: extracted`
4. Deactivates the original episodic node

### Confirm / discard agent nodes

Nodes with `provenance: agent` and `confirmed: false` show an **amber left border** and an inline strip:
- **Keep** — confirms the node
- **Discard** — deletes it

These appear after the chat auto-extraction or the Infer features below.

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

### Cross-conversation sharing

Open the inspector for any node. The **"In conversations"** section shows all conversations it belongs to. Use **Add** to share it into additional conversations.

---

## AI features

### Import / Extract

The **Import / Extract** button (folder icon) opens a dialog with three tabs:

**Extract** — paste any conversation text. The LLM parses it into structured nodes and imports them with `provenance: extracted`.

**Memory import** — paste a Claude.ai / ChatGPT memory export, or a raw JSON array of nodes.

**Summarize** — select 2+ nodes and distil them into one consolidated semantic node.

---

### Chat with memory context

<!-- ![Chat panel](./docs/screenshots/chat-annotated.png) -->

Click **Chat** in the topbar. Features:

- **Context injection** — active, non-sensitive, non-group-disabled nodes are injected as background for every message
- **Mem0 integration** — if configured, recalls from Mem0 semantically and saves back after each exchange
- **Recall transparency** — expand "X memories recalled" under each assistant reply to see exactly which nodes were used (with links back to node titles)
- **Auto-extraction** — after each exchange the LLM extracts key facts as **unconfirmed agent nodes** (amber, require your confirmation in the graph); a badge shows "N nodes extracted"
- **Pause memorization** (⏸) — disables Mem0 sync and auto-extraction for the current session without losing chat context

---

### Infer from selection

Select **2 or more nodes**, then click **Infer** in the bottom bar. The LLM analyses the combination and generates 3–6 **inference candidates** — facts, goals, or preferences that likely follow from the selected nodes.

A picker modal lets you review each candidate (title, content, confidence, reasoning) and choose which ones to add. Added nodes get `provenance: agent, confirmed: false`.

<!-- ![Inference picker](./docs/screenshots/inference-picker.png) -->

---

### Exploratory inference

Click the **Explore** button (telescope icon) in the topbar. Two modes:

**Infer hidden facts** — the LLM analyses your entire active knowledge base and predicts facts, skills, or preferences that are probably true but not yet recorded. Each candidate shows a confidence score and a reasoning blurb.

**Suggest relevant knowledge** — the LLM suggests skills to learn, topics to explore, or goals to articulate, based on your profile. Useful for discovering gaps.

Both produce a selectable list — picked items are added as unconfirmed agent nodes.

<!-- ![Explore modal](./docs/screenshots/explore-modal.png) -->

---

## Copy context to clipboard

The **clipboard icon** copies all active, non-sensitive nodes as a structured Markdown block:

```markdown
## My context — June 1, 2025

### Skills
- **Figma — expert**: Uses Figma as primary design tool…

### Goals
- **Ship Palette v1 by summer**: Palette is a side project…
```

Paste this into any AI chat to instantly ground the conversation with your knowledge graph.

---

## Inspector panel

Click any node to open its inspector on the right side. Features:
- Full edit form: category, memory type, confidence, scope (dropdown), source (dropdown), importance slider, tags with live preview
- **In conversations** — shows all conversations the node is linked to; add/remove
- Delete node

---

## Settings

Open **Settings** (gear icon) to configure:
- AI provider API keys (Groq · Gemini · Cerebras · Claude · OpenAI · Mistral · Ollama local)
- Mem0 API key and user ID for live sync
- Theme

---

## Provider support

API keys are stored only in `localStorage` and never sent anywhere except the provider's own API endpoint.

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

## License

MIT
