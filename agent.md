# AGENT.MD - LinkedPilot OS

This file serves as the operational manual and "Truth Engine" for AI agents working on the LinkedPilot repository. It complements `CLAUDE.md` by providing deep-dive technical protocols and automation logic.

## 1. System DNA
LinkedPilot is a multi-tenant LinkedIn automation platform. It operates as a triangle:
1.  **Dashboard (Frontend)**: Vite + React. Manages user state, campaigns, and lead visualization.
2.  **Edge Functions (Orchestrator)**: Deno (Supabase Hooks). Handles encrypted vault access, RLS bypass, and AI enrichment.
3.  **Chrome Extension (Execution)**: Plasmo. Intercepts LinkedIn network traffic and performs automated actions via stealth injection.

## 2. Core Operational Protocols

### 2.1 The "Truth on Ground" Extraction
Extraction must prioritize **Network Interception** over **DOM Scraping**.
- **Interceptor**: `extension/contents/interceptor.ts` captures `/voyager/api/graphql` in the MAIN world.
- **Normalization**: `extension/contents/linkedin.ts` parses `searchDashClustersByAll`.
- **Constraint**: DOM scraping should ONLY be used as a fallback if the API buffer is empty or the user is on a legacy page.

### 2.2 Navigation-Resilient Action Queue
Actions triggered from the dashboard/backend follow this state machine:
1.  **Dispatch**: Action inserted into `action_queue` with status `pending`.
2.  **Pickup**: Extension's `background.ts` receives Realtime event or Alarm-based poll.
3.  **Execution**: 
    - If Page = Tab.URL: Execute.
    - If Page != Tab.URL: Initiate navigation -> return `status: "navigating"`.
4.  **Resumption**: `waitForNavigationAndRetry` in `background.ts` catches the reload, waits for SPA settle (5s), and re-triggers the action.

### 2.3 RLS (Row-Level Security) Bypass Strategy
The Chrome Extension operates without a standard Supabase User session (as users don't login to the extension directly). 
- **Rule**: NEVER write directly to Supabase from the extension unless an `anon_key` with broad RLS is present (unlikely).
- **Protocol**: Use the `save-leads` and `connect-cookie` Edge Functions. These functions use the `service_role` key to bypass RLS after verifying the `workspace_id` and the associated LinkedIn account.

## 3. LinkedIn Interaction Guards (Anti-Scraping)
Every automated action must follow these constraints to prevent account flags:
- **Random Delays**: Use `randomDelay(min, max)` (default 2s-8s) between every click or navigation.
- **Human Scrolling**: Use `autoScroll(limit, speed)` before capturing data to ensure lazy-loaded items are hydrated.
- **Stealth Selectors**: Prioritize `data-view-name` attributes (introduced in 2025/2026 update) over dynamic CSS classes.

## 4. Repository Manifest (Hot Files)

| Path | Purpose | Key Logic |
|---|---|---|
| `/extension/contents/interceptor.ts` | MAIN World Hook | Intercept XHR/Fetch |
| `/extension/contents/linkedin.ts` | Automation Engine | Scrapers, API Parsers, Action Handlers |
| `/extension/background.ts` | Hub | Realtime, Navigation State, Alarms |
| `/supabase/functions/save-leads/` | Backend Gate | Deduplication, Lead Upsert, Status Update |
| `/src/hooks/useActionQueue.js` | Dashboard Link | Action Dispatching & Feedback |

## 5. Agent Behavioral Governance
1.  **Workspace Isolation**: Every query MUST have `.eq('workspace_id', workspaceId)`. 
2.  **No Direct Gemini Calls**: Frontend -> Supabase Edge Function -> Gemini API.
3.  **Interceptor Manual Reload**: Remind the user to reload the extension via `chrome://extensions` whenever `interceptor.ts` is changed.
4.  **Schema Consistency**: Reference `supabase/schema.sql` before adding new state fields to leads or campaigns.

## 6. Project Status (as of April 2026)
- [x] Modernized to Voyager GraphQL architecture.
- [x] Implemented Navigation State persistence.
- [/] Inbox Sync active (polling basis).
- [ ] Connect Account via Credentials (pending Render worker fix).
