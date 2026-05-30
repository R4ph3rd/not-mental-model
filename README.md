# Mental Model

A React interface for **visualising and managing the knowledge base of an AI agent** — everything it knows about you, your projects, preferences, goals, and past conversations. Memory is treated as data you can see, edit, and control, rather than an opaque black box.

Built with React + TypeScript, Vite, Tailwind v4, shadcn/ui-style components, and the Claude API.

## What it does

Each thing the agent "knows" is a **node** with a category (project, conversation, fact, preference, goal, skill), a memory type, a confidence level, tags, and a project scope. You can browse, search, edit, link, and delete these nodes — and directly control which ones the agent is allowed to use.

### Two views
- **Canvas** — a spatial map of nodes auto-clustered by category, with links drawn between related memories. Drag to reposition, scroll to zoom, drag the background to pan, "fit all" to recenter.
- **Grid** — a dense card layout for scanning and bulk actions.

### Core actions
- **Toggle visibility** (eye icon) — hide a node from the agent without deleting it.
- **Pin** — protect a node from decay so it's always retained.
- **Add / Edit / Delete** — full CRUD via a form (category, memory type, scope, importance, confidence).
- **Scopes** — group memories by project/domain (Work, Personal, …) and filter the whole view to one scope.
- **Decay bar** — every node shows a retention strength from `recency × 0.4 + importance × 0.35 + confidence × 0.25`; pinned nodes stay at full.
- **Extract** (Claude) — paste a conversation or notes and Claude turns it into structured nodes.
- **Summarize** (Claude) — select several nodes and distill them into one consolidated semantic memory.
- **Export** — download selected (or all) nodes as JSON.

Everything persists to `localStorage`. The Claude API key is stored locally and only sent to Anthropic.

## Run it

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
```

Open the dev URL, then click **Extract** to paste a conversation, or **Add** to create nodes by hand. To use Extract/Summarize, paste an Anthropic API key (`sk-ant-...`) into the dialog.

## Grounding in HCI research

The design borrows directly from recent work on agent-memory interfaces:

- **Memory Sandbox** (Huang et al., UIST 2023) — the "memory as an editable object" framing and its affordances: toggle visibility, add/edit/delete, and summarize.
- **Users' Expectations and Practices with Agent Memory** (CHI 2025) — evidence that users want memory organised into project/task **scopes**, which drives the scope hierarchy.
- **On the Regulatory Potential of User Interfaces for AI Agent Governance** (2024) — argues agent memory should be **inspectable and editable** with easily discoverable controls; hence always-visible edit/toggle controls.
- **Memory Management for Long-Running Low-Code Agents** (Xu, 2025) — the **episodic/semantic** split and the **importance-weighted decay** mechanic with visual tagging for what to retain.
