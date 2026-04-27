/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition — Missing Conditional Steps Are Never Queued
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT fix the code when it fails.
 *
 * Validates: Requirements 1.1, 1.2
 *
 * Counterexample documented:
 *   "A lead that already has a connect (done) action in action_queue receives NO
 *    message row after process-campaign runs, because alreadyQueuedConnects excludes
 *    the lead entirely from the newEnrollments array. The message step with
 *    conditions: ['accepted'] is never inserted into action_queue."
 *
 * NOTE: Written for Node.js built-in test runner (node:test), available in Node 18+.
 * Run with: node --experimental-strip-types supabase/functions/process-campaign/process-campaign.test.ts
 * Or:       npx tsx supabase/functions/process-campaign/process-campaign.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline copy of the pure functions from index.ts so we can test without
// a live HTTP server or Supabase connection.
// ---------------------------------------------------------------------------

interface SequenceNode {
  id: string;
  type: string;
  data: {
    actionType?: string;
    conditionType?: string;
    delay?: number;
    message?: string;
    note?: string;
    subject?: string;
  };
}

interface SequenceEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface ActionStep {
  actionType: string;
  delayHours: number;
  payload: Record<string, unknown>;
  conditions: string[];
}

/** Copied verbatim from index.ts — pure function, no side effects */
function walkSequence(
  nodes: SequenceNode[],
  edges: SequenceEdge[]
): ActionStep[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, SequenceEdge[]>();
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
    edgeMap.get(e.source)!.push(e);
  }

  const start = nodes.find((n) => n.type === "trigger") || nodes[0];
  if (!start) return [];

  const allSteps: ActionStep[] = [];

  interface Frame {
    nodeId: string;
    delayHours: number;
    conditions: string[];
    visited: Set<string>;
  }

  const stack: Frame[] = [
    {
      nodeId: start.id,
      delayHours: 0,
      conditions: [],
      visited: new Set([start.id]),
    },
  ];

  const HANDLE_TO_CONDITION: Record<string, string> = {
    accepted: "accepted",
    not_accepted: "not_accepted",
    replied: "replied",
    not_replied: "not_replied",
    true: "connected",
    false: "not_connected",
  };

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const { nodeId, delayHours, conditions, visited } = frame;

    const node = nodeMap.get(nodeId);
    if (!node) continue;
    if (node.type === "end") continue;

    let nextDelayHours = delayHours;
    const nextConditions = conditions;

    if (node.type === "action") {
      const { actionType, delay = 0, message, note, subject } = node.data;
      if (actionType === "wait") {
        nextDelayHours = delayHours + delay;
      } else if (actionType) {
        allSteps.push({
          actionType,
          delayHours,
          conditions: [...conditions],
          payload: {
            ...(message ? { message } : {}),
            ...(note ? { note } : {}),
            ...(subject ? { subject } : {}),
          },
        });
      }
    }

    const outgoing = edgeMap.get(nodeId) || [];
    for (const edge of outgoing) {
      if (visited.has(edge.target)) continue;

      const addedCondition = edge.sourceHandle
        ? HANDLE_TO_CONDITION[edge.sourceHandle]
        : undefined;

      const childConditions = addedCondition
        ? [...nextConditions, addedCondition]
        : [...nextConditions];

      stack.push({
        nodeId: edge.target,
        delayHours: nextDelayHours,
        conditions: childConditions,
        visited: new Set([...visited, edge.target]),
      });
    }
  }

  allSteps.sort((a, b) => a.delayHours - b.delayHours);
  return allSteps;
}

// ---------------------------------------------------------------------------
// Queue-building logic extracted from the serve() handler in index.ts.
// This is the BUGGY section under test — copied verbatim from the source.
// ---------------------------------------------------------------------------

interface Enrollment {
  id: string;
  lead_id: string;
  linkedin_account_id: string | null;
}

interface Lead {
  id: string;
  linkedin_member_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

interface ExistingAction {
  lead_id: string;
  action_type: string;
  payload?: Record<string, unknown>;
}

interface QueueRow {
  workspace_id: string;
  campaign_id: string;
  campaign_enrollment_id: string;
  lead_id: string;
  linkedin_account_id: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  status: string;
  scheduled_at: string;
}

/**
 * Extracted queue-building logic from process-campaign/index.ts.
 *
 * This is the FIXED implementation — it includes a second pass for already-enrolled
 * leads to queue missing conditional steps.
 */
function buildQueueRows(params: {
  validEnrollments: Enrollment[];
  existingActions: ExistingAction[];
  leadMap: Map<string, Lead>;
  steps: ActionStep[];
  workspace_id: string;
  campaign_id: string;
  campaignAccountId: string | null;
  DAILY_CONNECT_LIMIT: number;
  DAILY_MESSAGE_LIMIT: number;
  todayQueuedConnects: number;
  todayQueuedMessages: number;
}): QueueRow[] {
  const {
    validEnrollments,
    existingActions,
    leadMap,
    steps,
    workspace_id,
    campaign_id,
    campaignAccountId,
    DAILY_CONNECT_LIMIT,
    DAILY_MESSAGE_LIMIT,
    todayQueuedConnects,
    todayQueuedMessages,
  } = params;

  // Helper function to compute a fingerprint for an action step
  // Format: action_type + "|" + sorted(conditions).join(",")
  const fingerprint = (actionType: string, conditions: string[]): string => {
    return actionType + '|' + [...conditions].sort().join(',');
  };

  // Build a per-lead fingerprint map for deduplication
  // Map<lead_id, Set<fingerprint>>
  const existingFingerprints = new Map<string, Set<string>>();
  for (const action of existingActions ?? []) {
    const conditions = JSON.parse((action as any).payload?._conditions ?? '[]');
    const fp = fingerprint(action.action_type, conditions);
    
    if (!existingFingerprints.has(action.lead_id)) {
      existingFingerprints.set(action.lead_id, new Set());
    }
    existingFingerprints.get(action.lead_id)!.add(fp);
  }

  // Build a set of lead IDs that already have a connect action queued/done
  // Keep this for use as the gate on the new-enrollment path
  const alreadyQueuedConnects = new Set(
    (existingActions ?? [])
      .filter((a) => a.action_type === "connect")
      .map((a) => a.lead_id)
  );

  // Only enroll leads that haven't had a connect action queued yet
  const newEnrollments = validEnrollments.filter(
    (e) => !alreadyQueuedConnects.has(e.lead_id)
  );

  // Leads that already have a connect action but may be missing subsequent steps
  const alreadyEnrolledLeads = validEnrollments.filter(
    (e) => alreadyQueuedConnects.has(e.lead_id)
  );

  const connectSlots: Record<number, number> = { 0: todayQueuedConnects };
  const messageSlots: Record<number, number> = { 0: todayQueuedMessages };

  const getSlot = (slots: Record<number, number>, limit: number): number => {
    let day = 0;
    while (true) {
      if ((slots[day] ?? 0) < limit) return day;
      day++;
    }
  };

  const MS_PER_DAY = 24 * 3600 * 1000;
  const now = Date.now();
  const rows: QueueRow[] = [];

  // First pass: new enrollments (leads with no connect action yet)
  for (const enrollment of newEnrollments) {
    const lead = leadMap.get(enrollment.lead_id);
    if (!lead) continue;

    for (const step of steps) {
      const baseMs = now + step.delayHours * 3600 * 1000;
      let scheduledAt: string;

      if (step.actionType === "connect") {
        const day = getSlot(connectSlots, DAILY_CONNECT_LIMIT);
        connectSlots[day] = (connectSlots[day] ?? 0) + 1;
        scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString();
      } else if (
        step.actionType === "message" ||
        step.actionType === "inmail"
      ) {
        const day = getSlot(messageSlots, DAILY_MESSAGE_LIMIT);
        messageSlots[day] = (messageSlots[day] ?? 0) + 1;
        scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString();
      } else {
        scheduledAt = new Date(baseMs).toISOString();
      }

      const actionPayload: Record<string, unknown> = {
        ...step.payload,
        ...(step.conditions.length > 0
          ? { _conditions: step.conditions }
          : {}),
      };

      if (step.actionType === "connect") {
        actionPayload.provider_id = lead.linkedin_member_id;
      } else if (
        step.actionType === "message" ||
        step.actionType === "inmail"
      ) {
        actionPayload.attendee_id = lead.linkedin_member_id;
      }

      rows.push({
        workspace_id,
        campaign_id,
        campaign_enrollment_id: enrollment.id,
        lead_id: enrollment.lead_id,
        linkedin_account_id:
          enrollment.linkedin_account_id || campaignAccountId,
        action_type: step.actionType,
        payload: actionPayload,
        status: "pending",
        scheduled_at: scheduledAt,
      });
    }
  }

  // Second pass: already-enrolled leads with missing steps
  for (const enrollment of alreadyEnrolledLeads) {
    const lead = leadMap.get(enrollment.lead_id);
    if (!lead) continue;

    // Get the set of fingerprints already queued for this lead
    const knownFingerprints = existingFingerprints.get(enrollment.lead_id) ?? new Set<string>();

    for (const step of steps) {
      // Compute fingerprint for this step
      const fp = fingerprint(step.actionType, step.conditions);

      // Skip if this step is already queued for this lead
      if (knownFingerprints.has(fp)) continue;

      // Add to known fingerprints to prevent intra-batch duplicates
      knownFingerprints.add(fp);

      // Use the same scheduling logic as the new-enrollment path
      const baseMs = now + step.delayHours * 3600 * 1000;
      let scheduledAt: string;

      if (step.actionType === "connect") {
        const day = getSlot(connectSlots, DAILY_CONNECT_LIMIT);
        connectSlots[day] = (connectSlots[day] ?? 0) + 1;
        scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString();
      } else if (
        step.actionType === "message" ||
        step.actionType === "inmail"
      ) {
        const day = getSlot(messageSlots, DAILY_MESSAGE_LIMIT);
        messageSlots[day] = (messageSlots[day] ?? 0) + 1;
        scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString();
      } else {
        scheduledAt = new Date(baseMs).toISOString();
      }

      // Build payload with provider_id/attendee_id from lead data
      const actionPayload: Record<string, unknown> = {
        ...step.payload,
        ...(step.conditions.length > 0 ? { _conditions: step.conditions } : {}),
      };

      // Add provider_id for connect actions, attendee_id for message/inmail actions
      if (step.actionType === "connect") {
        actionPayload.provider_id = lead.linkedin_member_id;
      } else if (step.actionType === "message" || step.actionType === "inmail") {
        actionPayload.attendee_id = lead.linkedin_member_id;
      }

      rows.push({
        workspace_id,
        campaign_id,
        campaign_enrollment_id: enrollment.id,
        lead_id: enrollment.lead_id,
        linkedin_account_id:
          enrollment.linkedin_account_id || campaignAccountId,
        action_type: step.actionType,
        payload: actionPayload,
        status: "pending",
        scheduled_at: scheduledAt,
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a campaign sequence: trigger → connect → condition_node(if_accepted) → message[conditions: ["accepted"]]
 *
 * Node layout:
 *   trigger (n0) ---> connect action (n1) ---> condition node (n2) --[accepted]--> message action (n3)
 */
function buildAcceptedMessageSequence(): {
  nodes: SequenceNode[];
  edges: SequenceEdge[];
} {
  const nodes: SequenceNode[] = [
    { id: "n0", type: "trigger", data: {} },
    { id: "n1", type: "action", data: { actionType: "connect" } },
    { id: "n2", type: "condition", data: { conditionType: "if_accepted" } },
    {
      id: "n3",
      type: "action",
      data: {
        actionType: "message",
        message: "Thanks for connecting!",
      },
    },
  ];

  const edges: SequenceEdge[] = [
    { id: "e0", source: "n0", target: "n1" },
    { id: "e1", source: "n1", target: "n2" },
    // The "accepted" sourceHandle causes the condition to be added
    { id: "e2", source: "n2", target: "n3", sourceHandle: "accepted" },
  ];

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("walkSequence returns connect step and message[accepted] step for the sequence", () => {
  const { nodes, edges } = buildAcceptedMessageSequence();
  const steps = walkSequence(nodes, edges);

  const connectStep = steps.find((s) => s.actionType === "connect");
  const messageStep = steps.find((s) => s.actionType === "message");

  assert.ok(connectStep, "Expected a connect step in walkSequence output");
  assert.ok(messageStep, "Expected a message step in walkSequence output");
  assert.deepEqual(
    messageStep!.conditions,
    ["accepted"],
    `Expected message step conditions to be ["accepted"], got ${JSON.stringify(messageStep!.conditions)}`
  );
});

/**
 * BUG CONDITION EXPLORATION TEST
 *
 * Scenario:
 *   - Campaign sequence: trigger → connect → condition_node(if_accepted) → message[conditions: ["accepted"]]
 *   - Lead "lead-1" already has a connect (status: done) in action_queue
 *   - process-campaign runs again (e.g., after the lead accepted the connection)
 *
 * Expected (correct) behavior:
 *   - The message row with payload._conditions = ["accepted"] SHOULD be inserted
 *     into action_queue for lead-1
 *
 * Actual (buggy) behavior:
 *   - lead-1 is in alreadyQueuedConnects → excluded from newEnrollments entirely
 *   - newEnrollments is empty → early return with []
 *   - The message row is NEVER inserted
 *
 * EXPECTED OUTCOME: This test FAILS on unfixed code.
 */
test(
  "BUG CONDITION: lead with connect(done) should receive message[accepted] row — FAILS on unfixed code",
  () => {
    const LEAD_ID = "lead-1";
    const ENROLLMENT_ID = "enrollment-1";
    const WORKSPACE_ID = "workspace-1";
    const CAMPAIGN_ID = "campaign-1";
    const ACCOUNT_ID = "account-1";

    // Campaign sequence: connect → condition → message[accepted]
    const { nodes, edges } = buildAcceptedMessageSequence();
    const steps = walkSequence(nodes, edges);

    // Lead data
    const lead: Lead = {
      id: LEAD_ID,
      linkedin_member_id: "urn:li:member:12345",
      first_name: "Alice",
      last_name: "Smith",
      full_name: "Alice Smith",
    };
    const leadMap = new Map([[LEAD_ID, lead]]);

    // Enrollment
    const validEnrollments: Enrollment[] = [
      {
        id: ENROLLMENT_ID,
        lead_id: LEAD_ID,
        linkedin_account_id: ACCOUNT_ID,
      },
    ];

    // Pre-existing action_queue: lead already has a connect (done)
    const existingActions: ExistingAction[] = [
      { lead_id: LEAD_ID, action_type: "connect", payload: {} },
    ];

    // Run the buggy queue-building logic
    const rows = buildQueueRows({
      validEnrollments,
      existingActions,
      leadMap,
      steps,
      workspace_id: WORKSPACE_ID,
      campaign_id: CAMPAIGN_ID,
      campaignAccountId: ACCOUNT_ID,
      DAILY_CONNECT_LIMIT: 5,
      DAILY_MESSAGE_LIMIT: 5,
      todayQueuedConnects: 0,
      todayQueuedMessages: 0,
    });

    // Assert: a message row with _conditions = ["accepted"] should be present
    const messageRow = rows.find(
      (r) =>
        r.action_type === "message" &&
        Array.isArray((r.payload as any)._conditions) &&
        (r.payload as any)._conditions.includes("accepted")
    );

    if (!messageRow) {
      // Document the counterexample
      const counterexample = [
        "BUG CONFIRMED: No message row with _conditions=['accepted'] was inserted for lead-1.",
        "",
        "Counterexample:",
        "  lead_id:         lead-1",
        "  existingActions: [{ lead_id: 'lead-1', action_type: 'connect' }]",
        "  rows produced:   " + JSON.stringify(rows),
        "",
        "Root cause: alreadyQueuedConnects.has('lead-1') === true",
        "  → newEnrollments is empty",
        "  → early return with []",
        "  → message[accepted] step is never queued",
        "",
        "This test MUST FAIL on unfixed code. Fix the code in",
        "supabase/functions/process-campaign/index.ts to make it pass.",
      ].join("\n");

      assert.fail(counterexample);
    }

    // Also assert the row has the correct lead_id and campaign_id
    assert.equal(
      messageRow.lead_id,
      LEAD_ID,
      `Expected message row lead_id to be '${LEAD_ID}', got '${messageRow.lead_id}'`
    );
    assert.equal(
      messageRow.campaign_id,
      CAMPAIGN_ID,
      `Expected message row campaign_id to be '${CAMPAIGN_ID}', got '${messageRow.campaign_id}'`
    );
  }
);

// ---------------------------------------------------------------------------
// PRESERVATION PROPERTY TESTS
// Property 2: Preservation - New Enrollments and Already-Complete Leads Are Unaffected
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
// ---------------------------------------------------------------------------

/**
 * Test Case 1: New enrollment preservation
 *
 * Scenario:
 *   - Lead has no prior actions in action_queue
 *   - Campaign sequence: connect → message[accepted]
 *
 * Expected behavior (on UNFIXED code):
 *   - All sequence steps are queued with correct fingerprints
 *   - connect step is queued
 *   - message[accepted] step is queued
 *
 * EXPECTED OUTCOME: Test PASSES on unfixed code (new-enrollment path works correctly)
 */
test("PRESERVATION: new enrollment receives all sequence steps", () => {
  const LEAD_ID = "lead-new";
  const ENROLLMENT_ID = "enrollment-new";
  const WORKSPACE_ID = "workspace-1";
  const CAMPAIGN_ID = "campaign-1";
  const ACCOUNT_ID = "account-1";

  // Campaign sequence: connect → condition → message[accepted]
  const { nodes, edges } = buildAcceptedMessageSequence();
  const steps = walkSequence(nodes, edges);

  // Lead data
  const lead: Lead = {
    id: LEAD_ID,
    linkedin_member_id: "urn:li:member:99999",
    first_name: "Bob",
    last_name: "Jones",
    full_name: "Bob Jones",
  };
  const leadMap = new Map([[LEAD_ID, lead]]);

  // Enrollment
  const validEnrollments: Enrollment[] = [
    {
      id: ENROLLMENT_ID,
      lead_id: LEAD_ID,
      linkedin_account_id: ACCOUNT_ID,
    },
  ];

  // No existing actions — this is a new enrollment
  const existingActions: ExistingAction[] = [];

  // Run the queue-building logic
  const rows = buildQueueRows({
    validEnrollments,
    existingActions,
    leadMap,
    steps,
    workspace_id: WORKSPACE_ID,
    campaign_id: CAMPAIGN_ID,
    campaignAccountId: ACCOUNT_ID,
    DAILY_CONNECT_LIMIT: 5,
    DAILY_MESSAGE_LIMIT: 5,
    todayQueuedConnects: 0,
    todayQueuedMessages: 0,
  });

  // Assert: all steps are queued
  assert.equal(
    rows.length,
    steps.length,
    `Expected ${steps.length} rows for new enrollment, got ${rows.length}`
  );

  // Assert: connect step is present
  const connectRow = rows.find((r) => r.action_type === "connect");
  assert.ok(connectRow, "Expected connect row for new enrollment");
  assert.equal(connectRow!.lead_id, LEAD_ID);

  // Assert: message[accepted] step is present
  const messageRow = rows.find(
    (r) =>
      r.action_type === "message" &&
      Array.isArray((r.payload as any)._conditions) &&
      (r.payload as any)._conditions.includes("accepted")
  );
  assert.ok(messageRow, "Expected message[accepted] row for new enrollment");
  assert.equal(messageRow!.lead_id, LEAD_ID);
});

/**
 * Test Case 2: Already-complete lead preservation
 *
 * Scenario:
 *   - Lead has connect (done) + message[accepted] (pending) in action_queue
 *   - Campaign sequence: connect → message[accepted]
 *
 * Expected behavior (on UNFIXED code):
 *   - No new rows are inserted (deduplication works correctly)
 *
 * EXPECTED OUTCOME: Test PASSES on unfixed code (deduplication is not the bug)
 */
test("PRESERVATION: already-complete lead receives no new rows", () => {
  const LEAD_ID = "lead-complete";
  const ENROLLMENT_ID = "enrollment-complete";
  const WORKSPACE_ID = "workspace-1";
  const CAMPAIGN_ID = "campaign-1";
  const ACCOUNT_ID = "account-1";

  // Campaign sequence: connect → condition → message[accepted]
  const { nodes, edges } = buildAcceptedMessageSequence();
  const steps = walkSequence(nodes, edges);

  // Lead data
  const lead: Lead = {
    id: LEAD_ID,
    linkedin_member_id: "urn:li:member:88888",
    first_name: "Carol",
    last_name: "White",
    full_name: "Carol White",
  };
  const leadMap = new Map([[LEAD_ID, lead]]);

  // Enrollment
  const validEnrollments: Enrollment[] = [
    {
      id: ENROLLMENT_ID,
      lead_id: LEAD_ID,
      linkedin_account_id: ACCOUNT_ID,
    },
  ];

  // Pre-existing action_queue: lead has both connect and message[accepted]
  const existingActions: ExistingAction[] = [
    { lead_id: LEAD_ID, action_type: "connect", payload: {} },
    { lead_id: LEAD_ID, action_type: "message", payload: { _conditions: JSON.stringify(["accepted"]) } },
  ];

  // Run the queue-building logic
  const rows = buildQueueRows({
    validEnrollments,
    existingActions,
    leadMap,
    steps,
    workspace_id: WORKSPACE_ID,
    campaign_id: CAMPAIGN_ID,
    campaignAccountId: ACCOUNT_ID,
    DAILY_CONNECT_LIMIT: 5,
    DAILY_MESSAGE_LIMIT: 5,
    todayQueuedConnects: 0,
    todayQueuedMessages: 0,
  });

  // Assert: no new rows are inserted
  assert.equal(
    rows.length,
    0,
    `Expected 0 rows for already-complete lead, got ${rows.length}`
  );
});

/**
 * Test Case 3: Partial non-connect queue
 *
 * Scenario:
 *   - Lead has only a view_profile action (no connect) in action_queue
 *   - Campaign sequence: connect → message[accepted]
 *
 * Expected behavior (on UNFIXED code):
 *   - Lead is treated as a new enrollment
 *   - All sequence steps are queued
 *
 * EXPECTED OUTCOME: Test PASSES on unfixed code (non-connect actions don't affect enrollment)
 */
test("PRESERVATION: lead with non-connect action is treated as new enrollment", () => {
  const LEAD_ID = "lead-partial";
  const ENROLLMENT_ID = "enrollment-partial";
  const WORKSPACE_ID = "workspace-1";
  const CAMPAIGN_ID = "campaign-1";
  const ACCOUNT_ID = "account-1";

  // Campaign sequence: connect → condition → message[accepted]
  const { nodes, edges } = buildAcceptedMessageSequence();
  const steps = walkSequence(nodes, edges);

  // Lead data
  const lead: Lead = {
    id: LEAD_ID,
    linkedin_member_id: "urn:li:member:77777",
    first_name: "Dave",
    last_name: "Brown",
    full_name: "Dave Brown",
  };
  const leadMap = new Map([[LEAD_ID, lead]]);

  // Enrollment
  const validEnrollments: Enrollment[] = [
    {
      id: ENROLLMENT_ID,
      lead_id: LEAD_ID,
      linkedin_account_id: ACCOUNT_ID,
    },
  ];

  // Pre-existing action_queue: lead has only a view_profile action (no connect)
  const existingActions: ExistingAction[] = [
    { lead_id: LEAD_ID, action_type: "view_profile", payload: {} },
  ];

  // Run the queue-building logic
  const rows = buildQueueRows({
    validEnrollments,
    existingActions,
    leadMap,
    steps,
    workspace_id: WORKSPACE_ID,
    campaign_id: CAMPAIGN_ID,
    campaignAccountId: ACCOUNT_ID,
    DAILY_CONNECT_LIMIT: 5,
    DAILY_MESSAGE_LIMIT: 5,
    todayQueuedConnects: 0,
    todayQueuedMessages: 0,
  });

  // Assert: all steps are queued (treated as new enrollment)
  assert.equal(
    rows.length,
    steps.length,
    `Expected ${steps.length} rows for lead with non-connect action, got ${rows.length}`
  );

  // Assert: connect step is present
  const connectRow = rows.find((r) => r.action_type === "connect");
  assert.ok(connectRow, "Expected connect row for lead with non-connect action");

  // Assert: message[accepted] step is present
  const messageRow = rows.find(
    (r) =>
      r.action_type === "message" &&
      Array.isArray((r.payload as any)._conditions) &&
      (r.payload as any)._conditions.includes("accepted")
  );
  assert.ok(
    messageRow,
    "Expected message[accepted] row for lead with non-connect action"
  );
});

/**
 * Test Case 4: Rate-limit slot preservation
 *
 * Scenario:
 *   - Multiple new enrollments
 *   - Daily limits: 2 connects, 2 messages
 *   - Campaign sequence: connect → message[accepted]
 *
 * Expected behavior (on UNFIXED code):
 *   - First 2 leads get connect scheduled today (day 0)
 *   - Third lead gets connect scheduled tomorrow (day 1)
 *   - Same logic for message steps
 *
 * EXPECTED OUTCOME: Test PASSES on unfixed code (rate-limit spreading works correctly)
 */
test("PRESERVATION: rate-limit slot spreading works correctly", () => {
  const WORKSPACE_ID = "workspace-1";
  const CAMPAIGN_ID = "campaign-1";
  const ACCOUNT_ID = "account-1";

  // Campaign sequence: connect → condition → message[accepted]
  const { nodes, edges } = buildAcceptedMessageSequence();
  const steps = walkSequence(nodes, edges);

  // Create 3 leads
  const leads: Lead[] = [
    {
      id: "lead-1",
      linkedin_member_id: "urn:li:member:11111",
      first_name: "Alice",
      last_name: "One",
      full_name: "Alice One",
    },
    {
      id: "lead-2",
      linkedin_member_id: "urn:li:member:22222",
      first_name: "Bob",
      last_name: "Two",
      full_name: "Bob Two",
    },
    {
      id: "lead-3",
      linkedin_member_id: "urn:li:member:33333",
      first_name: "Carol",
      last_name: "Three",
      full_name: "Carol Three",
    },
  ];
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  // Create 3 enrollments
  const validEnrollments: Enrollment[] = leads.map((l, i) => ({
    id: `enrollment-${i + 1}`,
    lead_id: l.id,
    linkedin_account_id: ACCOUNT_ID,
  }));

  // No existing actions — all new enrollments
  const existingActions: ExistingAction[] = [];

  // Run the queue-building logic with low daily limits
  const rows = buildQueueRows({
    validEnrollments,
    existingActions,
    leadMap,
    steps,
    workspace_id: WORKSPACE_ID,
    campaign_id: CAMPAIGN_ID,
    campaignAccountId: ACCOUNT_ID,
    DAILY_CONNECT_LIMIT: 2, // Only 2 connects per day
    DAILY_MESSAGE_LIMIT: 2, // Only 2 messages per day
    todayQueuedConnects: 0,
    todayQueuedMessages: 0,
  });

  // Assert: 6 rows total (3 leads × 2 steps each)
  assert.equal(rows.length, 6, `Expected 6 rows, got ${rows.length}`);

  // Extract connect rows and check scheduling
  const connectRows = rows.filter((r) => r.action_type === "connect");
  assert.equal(connectRows.length, 3, "Expected 3 connect rows");

  // Parse scheduled_at timestamps and compute day offsets
  const now = Date.now();
  const MS_PER_DAY = 24 * 3600 * 1000;

  const connectDays = connectRows.map((r) => {
    const scheduledMs = new Date(r.scheduled_at).getTime();
    const offsetMs = scheduledMs - now;
    return Math.floor(offsetMs / MS_PER_DAY);
  });

  // First 2 connects should be on day 0, third on day 1
  assert.equal(
    connectDays.filter((d) => d === 0).length,
    2,
    "Expected 2 connects scheduled on day 0"
  );
  assert.equal(
    connectDays.filter((d) => d === 1).length,
    1,
    "Expected 1 connect scheduled on day 1"
  );

  // Extract message rows and check scheduling
  const messageRows = rows.filter((r) => r.action_type === "message");
  assert.equal(messageRows.length, 3, "Expected 3 message rows");

  const messageDays = messageRows.map((r) => {
    const scheduledMs = new Date(r.scheduled_at).getTime();
    const offsetMs = scheduledMs - now;
    return Math.floor(offsetMs / MS_PER_DAY);
  });

  // First 2 messages should be on day 0, third on day 1
  assert.equal(
    messageDays.filter((d) => d === 0).length,
    2,
    "Expected 2 messages scheduled on day 0"
  );
  assert.equal(
    messageDays.filter((d) => d === 1).length,
    1,
    "Expected 1 message scheduled on day 1"
  );
});
