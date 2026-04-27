// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Deno imports
import { corsHeaders, handleCors } from '../_shared/cors.ts'
// @ts-ignore - Deno imports
import { resolveAuth } from '../_shared/auth.ts'

// Deno global declaration for TypeScript editor support
declare const Deno: { env: { get(key: string): string | undefined } }

interface SequenceNode {
  id: string
  type: string
  data: {
    actionType?: string
    conditionType?: string
    delay?: number      // hours
    message?: string
    note?: string
    subject?: string
  }
}

interface SequenceEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

interface ActionStep {
  actionType: string
  delayHours: number   // cumulative from campaign start
  payload: Record<string, unknown>
  // Conditions that must ALL be true at execution time for this step to run.
  // e.g. ["accepted"] means only run if the lead accepted the connection request.
  // Empty array = always run.
  conditions: string[]
}

/**
 * Walk the full sequence DAG and return ALL action steps across every branch.
 *
 * Each step carries a `conditions` array that the worker checks at runtime:
 *   - "accepted"     → lead's connection_status is 'connected'
 *   - "not_accepted" → lead's connection_status is NOT 'connected' (still pending)
 *   - "replied"      → lead has sent at least one inbound message in this campaign
 *   - "not_replied"  → lead has NOT replied yet
 *   - "connected"    → lead was already connected before the campaign started
 *   - "not_connected"→ lead was not connected at enrollment
 *
 * Delay is cumulative along each path from the trigger node.
 */
function walkSequence(nodes: SequenceNode[], edges: SequenceEdge[]): ActionStep[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edgeMap = new Map<string, SequenceEdge[]>()
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    edgeMap.get(e.source)!.push(e)
  }

  const start = nodes.find(n => n.type === 'trigger') || nodes[0]
  if (!start) return []

  const allSteps: ActionStep[] = []

  // BFS/DFS stack: each entry is the current node, cumulative delay, and accumulated conditions
  interface Frame {
    nodeId: string
    delayHours: number
    conditions: string[]
    visited: Set<string>
  }

  const stack: Frame[] = [{
    nodeId: start.id,
    delayHours: 0,
    conditions: [],
    visited: new Set([start.id]),
  }]

  // Map sourceHandle values to runtime condition strings
  const HANDLE_TO_CONDITION: Record<string, string> = {
    'accepted':      'accepted',
    'not_accepted':  'not_accepted',
    'replied':       'replied',
    'not_replied':   'not_replied',
    'true':          'connected',      // if_connected → true branch
    'false':         'not_connected',  // if_connected → false branch
  }

  while (stack.length > 0) {
    const frame = stack.pop()!
    const { nodeId, delayHours, conditions, visited } = frame

    const node = nodeMap.get(nodeId)
    if (!node) continue
    if (node.type === 'end') continue

    let nextDelayHours = delayHours
    let nextConditions = conditions

    if (node.type === 'action') {
      const { actionType, delay = 0, message, note, subject } = node.data
      if (actionType === 'wait') {
        nextDelayHours = delayHours + delay
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
        })
      }
    }
    // condition nodes don't emit steps — they just branch via edges

    // Enqueue all outgoing edges as separate paths
    const outgoing = edgeMap.get(nodeId) || []
    for (const edge of outgoing) {
      if (visited.has(edge.target)) continue  // cycle guard

      // Derive the condition added by this edge's sourceHandle
      const addedCondition = edge.sourceHandle
        ? HANDLE_TO_CONDITION[edge.sourceHandle]
        : undefined

      const childConditions = addedCondition
        ? [...nextConditions, addedCondition]
        : [...nextConditions]

      stack.push({
        nodeId: edge.target,
        delayHours: nextDelayHours,
        conditions: childConditions,
        visited: new Set([...visited, edge.target]),
      })
    }
  }

  // Sort by delay so rows are inserted in chronological order
  allSteps.sort((a, b) => a.delayHours - b.delayHours)
  return allSteps
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { campaign_id, workspace_id } = await req.json()

    const { error: authError } = await resolveAuth(req, supabase, workspace_id)
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401, headers: corsHeaders,
      })
    }

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('id, linkedin_account_id, settings, sequence_json, daily_limit')
      .eq('id', campaign_id)
      .eq('workspace_id', workspace_id)
      .single()
    if (campErr || !campaign) throw campErr || new Error('Campaign not found')

    const { nodes = [], edges = [] } = (campaign.sequence_json || {}) as { nodes: SequenceNode[], edges: SequenceEdge[] }
    const steps = walkSequence(nodes, edges)

    if (steps.length === 0) {
      return new Response(JSON.stringify({ success: true, queued: 0, message: 'No action steps in sequence' }), {
        headers: corsHeaders,
      })
    }

    // Resolve account id: scalar column first, fall back to settings.linked_account_ids[0]
    const campaignAccountId: string | null =
      campaign.linkedin_account_id ||
      (campaign.settings?.linked_account_ids?.[0] ?? null)

    // Fetch account with daily counters
    const { data: account } = campaignAccountId
      ? await supabase
          .from('linkedin_accounts')
          .select('login_method, today_connections, today_messages, daily_connection_limit, daily_message_limit, connections_reset_at')
          .eq('id', campaignAccountId)
          .single()
      : { data: null }

    const DAILY_CONNECT_LIMIT = account?.daily_connection_limit ?? 5
    const DAILY_MESSAGE_LIMIT = account?.daily_message_limit ?? 5

    // Fetch active enrollments
    const { data: enrollments, error: enrollErr } = await supabase
      .from('campaign_enrollments')
      .select('id, lead_id, linkedin_account_id')
      .eq('campaign_id', campaign_id)
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')
    if (enrollErr) throw enrollErr

    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ success: true, queued: 0, message: 'No active enrollments' }), {
        headers: corsHeaders,
      })
    }

    // Fetch lead data including linkedin_member_id for all enrolled leads
    const leadIds = enrollments.map((e: any) => e.lead_id)
    const { data: leads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, linkedin_member_id, first_name, last_name, full_name')
      .in('id', leadIds)
    if (leadsErr) throw leadsErr

    // Create a map for quick lookup
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l]))

    // Filter out enrollments where lead is missing linkedin_member_id
    const validEnrollments = enrollments.filter((e: any) => {
      const lead = leadMap.get(e.lead_id) as any
      if (!lead?.linkedin_member_id) {
        console.warn(`Skipping enrollment ${e.id}: lead ${e.lead_id} missing linkedin_member_id`)
        return false
      }
      return true
    })

    if (validEnrollments.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        queued: 0, 
        message: 'No enrollments with valid linkedin_member_id. Please enrich leads first.' 
      }), {
        headers: corsHeaders,
      })
    }

    // Fetch existing action_queue entries for this campaign to avoid re-queuing
    // leads that already have a connect action pending, processing, or done.
    const { data: existingActions } = await supabase
      .from('action_queue')
      .select('lead_id, action_type, payload')
      .eq('campaign_id', campaign_id)
      .in('status', ['pending', 'processing', 'done'])

    // Helper function to compute a fingerprint for an action step
    // Format: action_type + "|" + sorted(conditions).join(",")
    // Example: "connect|" for a connect step with no conditions
    // Example: "message|accepted" for a message step with conditions: ["accepted"]
    const fingerprint = (actionType: string, conditions: string[]): string => {
      return actionType + '|' + [...conditions].sort().join(',')
    }

    // Build a per-lead fingerprint map for deduplication
    // Map<lead_id, Set<fingerprint>>
    const existingFingerprints = new Map<string, Set<string>>()
    for (const action of existingActions ?? []) {
      const conditions = JSON.parse((action.payload as any)?._conditions ?? '[]')
      const fp = fingerprint(action.action_type, conditions)
      
      if (!existingFingerprints.has(action.lead_id)) {
        existingFingerprints.set(action.lead_id, new Set())
      }
      existingFingerprints.get(action.lead_id)!.add(fp)
    }

    // Build a set of lead IDs that already have a connect action queued/done
    // Keep this for use as the gate on the new-enrollment path
    const alreadyQueuedConnects = new Set(
      (existingActions ?? [])
        .filter((a: any) => a.action_type === 'connect')
        .map((a: any) => a.lead_id)
    )

    // Only enroll leads that haven't had a connect action queued yet
    const newEnrollments = validEnrollments.filter((e: any) => !alreadyQueuedConnects.has(e.lead_id))

    // Leads that already have a connect action but may be missing subsequent steps
    const alreadyEnrolledLeads = validEnrollments.filter((e: any) => alreadyQueuedConnects.has(e.lead_id))

    // Count how many connect/message actions are already scheduled for today per account
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999)

    const { data: todayQueued } = await supabase
      .from('action_queue')
      .select('action_type')
      .eq('workspace_id', workspace_id)
      .eq('linkedin_account_id', campaignAccountId)
      .in('status', ['pending', 'processing', 'done'])
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())

    // Track how many slots are used per day (day 0 = today, day 1 = tomorrow, etc.)
    // connectSlots[d] = number of connect actions already scheduled on day d
    const connectSlots: Record<number, number> = {
      0: (todayQueued ?? []).filter((a: any) => a.action_type === 'connect').length
    }
    const messageSlots: Record<number, number> = {
      0: (todayQueued ?? []).filter((a: any) => a.action_type === 'message').length
    }

    const getSlot = (slots: Record<number, number>, limit: number): number => {
      let day = 0
      while (true) {
        if ((slots[day] ?? 0) < limit) return day
        day++
      }
    }

    // Build action_queue rows: spread across days respecting daily limits
    const MS_PER_DAY = 24 * 3600 * 1000
    const now = Date.now()
    const rows = []

    // First pass: new enrollments (leads with no connect action yet)
    for (const enrollment of newEnrollments) {
      const lead = leadMap.get(enrollment.lead_id) as any
      if (!lead) continue

      for (const step of steps) {
        const baseMs = now + step.delayHours * 3600 * 1000
        let scheduledAt: string

        if (step.actionType === 'connect') {
          const day = getSlot(connectSlots, DAILY_CONNECT_LIMIT)
          connectSlots[day] = (connectSlots[day] ?? 0) + 1
          scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString()
        } else if (step.actionType === 'message' || step.actionType === 'inmail') {
          const day = getSlot(messageSlots, DAILY_MESSAGE_LIMIT)
          messageSlots[day] = (messageSlots[day] ?? 0) + 1
          scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString()
        } else {
          scheduledAt = new Date(baseMs).toISOString()
        }

        // Build payload with provider_id/attendee_id from lead data
        const actionPayload: Record<string, unknown> = {
          ...step.payload,
          ...(step.conditions.length > 0 ? { _conditions: step.conditions } : {}),
        }

        // Add provider_id for connect actions, attendee_id for message/inmail actions
        if (step.actionType === 'connect') {
          actionPayload.provider_id = lead.linkedin_member_id
        } else if (step.actionType === 'message' || step.actionType === 'inmail') {
          actionPayload.attendee_id = lead.linkedin_member_id
        }

        rows.push({
          workspace_id,
          campaign_id,
          campaign_enrollment_id: enrollment.id,
          lead_id: enrollment.lead_id,
          linkedin_account_id: enrollment.linkedin_account_id || campaignAccountId,
          action_type: step.actionType,
          payload: actionPayload,
          status: 'pending',
          scheduled_at: scheduledAt,
        })
      }
    }

    // Second pass: already-enrolled leads with missing steps
    for (const enrollment of alreadyEnrolledLeads) {
      const lead = leadMap.get(enrollment.lead_id) as any
      if (!lead) continue

      // Get the set of fingerprints already queued for this lead
      const knownFingerprints = existingFingerprints.get(enrollment.lead_id) ?? new Set<string>()

      for (const step of steps) {
        // Compute fingerprint for this step
        const fp = fingerprint(step.actionType, step.conditions)

        // Skip if this step is already queued for this lead
        if (knownFingerprints.has(fp)) continue

        // Add to known fingerprints to prevent intra-batch duplicates
        knownFingerprints.add(fp)

        // Use the same scheduling logic as the new-enrollment path
        const baseMs = now + step.delayHours * 3600 * 1000
        let scheduledAt: string

        if (step.actionType === 'connect') {
          const day = getSlot(connectSlots, DAILY_CONNECT_LIMIT)
          connectSlots[day] = (connectSlots[day] ?? 0) + 1
          scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString()
        } else if (step.actionType === 'message' || step.actionType === 'inmail') {
          const day = getSlot(messageSlots, DAILY_MESSAGE_LIMIT)
          messageSlots[day] = (messageSlots[day] ?? 0) + 1
          scheduledAt = new Date(baseMs + day * MS_PER_DAY).toISOString()
        } else {
          scheduledAt = new Date(baseMs).toISOString()
        }

        // Build payload with provider_id/attendee_id from lead data
        const actionPayload: Record<string, unknown> = {
          ...step.payload,
          ...(step.conditions.length > 0 ? { _conditions: step.conditions } : {}),
        }

        // Add provider_id for connect actions, attendee_id for message/inmail actions
        if (step.actionType === 'connect') {
          actionPayload.provider_id = lead.linkedin_member_id
        } else if (step.actionType === 'message' || step.actionType === 'inmail') {
          actionPayload.attendee_id = lead.linkedin_member_id
        }

        rows.push({
          workspace_id,
          campaign_id,
          campaign_enrollment_id: enrollment.id,
          lead_id: enrollment.lead_id,
          linkedin_account_id: enrollment.linkedin_account_id || campaignAccountId,
          action_type: step.actionType,
          payload: actionPayload,
          status: 'pending',
          scheduled_at: scheduledAt,
        })
      }
    }

    // If no rows to insert, return early
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, queued: 0, message: 'No new actions to queue' }), {
        headers: corsHeaders,
      })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('action_queue')
      .insert(rows)
      .select('id')
    if (insertErr) throw insertErr

    // Notify Python worker for all outreach actions (extension only handles scrapeLeads)
    const WORKER_ACTION_TYPES = ['connect', 'message', 'view_profile', 'withdraw', 'inmail', 'scrapeLeads']
    const workerUrl = Deno.env.get('LOGIN_WORKER_URL')
    if (workerUrl && inserted) {
      for (const row of inserted) {
        const queuedRow = rows[inserted.indexOf(row)]
        if (WORKER_ACTION_TYPES.includes(queuedRow?.action_type)) {
          fetch(`${workerUrl}/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ action_id: row.id }),
          }).catch(err => console.error('Worker notify failed:', err))
        }
      }
    }

    return new Response(JSON.stringify({ success: true, queued: inserted?.length ?? 0 }), {
      headers: corsHeaders,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
