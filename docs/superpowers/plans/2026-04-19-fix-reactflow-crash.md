# Fix ReactFlow Crash & Edge Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `Maximum update depth exceeded` crash and `Couldn't create edge for source handle id: "replied"` ReactFlow errors in the campaign sequence builder.

**Architecture:** Two root causes in `SequencesStep.jsx`: (1) BASIC_TEMPLATE uses wrong `sourceHandle: 'replied'` on a `connect`-type ActionNode which only exposes `accepted`/`not_accepted` handles; (2) two `useEffect` hooks form a circular dependency — init reads `campaignData.sequence` → `setNodes` → sync writes back via `updateCampaignData` → `campaignData` changes → init re-fires → infinite loop. Fix both in one file.

**Tech Stack:** React 19, ReactFlow (reactflow), Zustand (WizardContext via `useWizard`)

---

### Task 1: Fix BASIC_TEMPLATE bad sourceHandle on edge e2-3

**Files:**
- Modify: `src/components/wizard/SequencesStep.jsx:122-126`

The BASIC_TEMPLATE starts a campaign with nodes: Trigger (id=1) → Connect (id=2) → Message (id=3) → End (id=4).  
`ActionNode` with `actionType: 'connect'` renders two source handles with ids `accepted` and `not_accepted` (from `DUAL.connect`).  
Edge `e2-3` passes `sourceHandle: 'replied'` — that handle does not exist on node 2, causing the ReactFlow error #008 spam.  
The semantically correct handle is `'accepted'` (lead accepted connection → proceed to first message).

- [ ] **Step 1: Open the file and locate BASIC_TEMPLATE edges**

File: `src/components/wizard/SequencesStep.jsx`, lines 122–126:
```js
  edges: [
    EDGE('e1-2', '1', '2'),
    EDGE('e2-3', '2', '3', { sourceHandle: 'replied' }),   // ← WRONG handle
    EDGE('e3-4', '3', '4', { sourceHandle: 'replied' }),
  ]
```

- [ ] **Step 2: Fix edge e2-3 sourceHandle**

Change `sourceHandle: 'replied'` to `sourceHandle: 'accepted'` on edge `e2-3`:

```js
  edges: [
    EDGE('e1-2', '1', '2'),
    EDGE('e2-3', '2', '3', { sourceHandle: 'accepted',  label: 'Accepted'  }),
    EDGE('e3-4', '3', '4', { sourceHandle: 'replied',   label: 'Replied'   }),
  ]
```

- [ ] **Step 3: Verify in browser**

Open the campaign builder → Sequences step. The ReactFlow console errors `Couldn't create edge for source handle id: "replied", edge id: e2-3` should be gone. The BASIC_TEMPLATE canvas should render the connect node with a green "Accepted" edge going to the message node.

- [ ] **Step 4: Commit**

```bash
git add src/components/wizard/SequencesStep.jsx
git commit -m "fix: correct BASIC_TEMPLATE edge e2-3 to use accepted handle on connect node"
```

---

### Task 2: Fix circular useEffect loop causing Maximum update depth exceeded

**Files:**
- Modify: `src/components/wizard/SequencesStep.jsx:129-148`

**Root cause:**  
Effect A (lines 135-143): deps `[campaignData.sequence.nodes, campaignData.sequence.edges]` → calls `setNodes` / `setEdges`.  
Effect B (lines 145-148): deps `[nodes, edges]` → calls `updateCampaignData({ sequence: { nodes, edges } })`.  

`updateCampaignData` writes to WizardContext, which creates a new `campaignData` object. That triggers Effect A again → `setNodes` again → `nodes` changes → Effect B again → infinite loop.

**Fix:** Guard Effect A with a `useRef` flag so it only initialises once on mount. After that, the component owns `nodes`/`edges` locally and only writes out (Effect B), never reads back.

- [ ] **Step 1: Add useRef import**

Line 1 currently reads:
```js
import React, { useState, useCallback, useEffect } from 'react'
```

Change to:
```js
import React, { useState, useCallback, useEffect, useRef } from 'react'
```

- [ ] **Step 2: Add initialized ref inside SequencesStep component**

After the `useState` declarations (around line 133), add:
```js
const initialized = useRef(false)
```

- [ ] **Step 3: Replace Effect A with a run-once guard**

Replace the current Effect A (lines 135-143):
```js
useEffect(() => {
  if (campaignData.sequence?.nodes?.length > 0) {
    setNodes(campaignData.sequence.nodes)
    setEdges(campaignData.sequence.edges)
  } else {
    setNodes(BASIC_TEMPLATE.nodes)
    setEdges(BASIC_TEMPLATE.edges)
  }
}, [campaignData.sequence.nodes, campaignData.sequence.edges])
```

With:
```js
useEffect(() => {
  if (initialized.current) return
  initialized.current = true
  if (campaignData.sequence?.nodes?.length > 0) {
    setNodes(campaignData.sequence.nodes)
    setEdges(campaignData.sequence.edges ?? [])
  } else {
    setNodes(BASIC_TEMPLATE.nodes)
    setEdges(BASIC_TEMPLATE.edges)
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Effect B (the sync-out effect) stays unchanged — it still writes to WizardContext whenever `nodes`/`edges` change, but the init effect never re-reads from WizardContext after mount, breaking the loop.

- [ ] **Step 4: Verify fix in browser**

1. Navigate to any campaign → Sequences step.
2. Open DevTools console — `Maximum update depth exceeded` error must be gone.
3. The ReactFlow canvas must render without crashing.
4. Add a node from the Step Library, confirm it appears on canvas and no new errors appear.
5. Navigate away (e.g. to Schedule step) and back — the sequence should still be saved (WizardContext retains it via Effect B).

- [ ] **Step 5: Commit**

```bash
git add src/components/wizard/SequencesStep.jsx
git commit -m "fix: break circular useEffect loop in SequencesStep causing infinite re-render crash"
```

---

### Task 3: Suppress residual ReactFlow nodeTypes warning (housekeeping)

**Files:**
- Modify: `src/components/wizard/SequencesStep.jsx:26-31`

The `nodeTypes` object is already defined at module level (outside the component), which is correct. The warning that appeared in the console was noise generated by the infinite-rerender loop (the component was crashing and remounting repeatedly). Once Task 2 is applied the warning disappears automatically.

No code change needed — verify after Tasks 1 & 2 are deployed.

- [ ] **Step 1: Confirm nodeTypes is at module level**

Check lines 26-31 of `src/components/wizard/SequencesStep.jsx`:
```js
const nodeTypes = {
  trigger:   TriggerNode,
  action:    ActionNode,
  condition: ConditionNode,
  end:       EndNode,
}
```
This must be **outside** any function/component. It is. No change needed.

- [ ] **Step 2: Verify warning is gone after prior tasks**

With Tasks 1 and 2 applied, open the browser console on the Sequences step and confirm there are no more `[React Flow]: It looks like you've created a new nodeTypes` warnings.

---

## Self-Review

**Spec coverage:**
- ✅ `e2-3` bad handle → Task 1
- ✅ `Maximum update depth exceeded` infinite loop → Task 2  
- ✅ `nodeTypes` warning → Task 3 (no-op, self-resolves)

**Placeholder scan:** No TBDs, all code blocks are complete.

**Type consistency:** `BASIC_TEMPLATE`, `FULL_TEMPLATE`, `EDGE`, `updateCampaignData`, `setNodes`, `setEdges` — all names match the existing codebase.
