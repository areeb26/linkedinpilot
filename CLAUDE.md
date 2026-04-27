# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# LinkedPilot — AI Context File

## What is this project?
LinkedPilot is a LinkedIn automation SaaS — a clone of SendPilot.ai.
It helps B2B agencies and sales teams automate LinkedIn outreach.

## Tech Stack
- Frontend: React 19 + Vite, React Router v6, Tailwind CSS, shadcn/ui
- State: Zustand (global), TanStack Query (server state)
- Forms: React Hook Form + Zod
- Charts: Recharts
- Sequence Builder: React Flow
- Backend: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- AI: Google Gemini 1.5 Pro via Supabase Edge Functions
- Chrome Extension: Vanilla esbuild (Manifest V3)
- Payments: Stripe
- Deploy: Vercel (frontend) + Supabase (backend) + Render (Python worker)

## Dev Commands

### Frontend
```bash
npm run dev          # start Vite dev server (frontend + backend together)
npm run dev:ui       # frontend only
npm run dev:backend  # backend only
npm run build        # production build
npm run lint         # ESLint (zero warnings policy)
npm run preview      # preview production build
```

### Chrome Extension
```bash
cd extension
node build.js        # production build → build/chrome-mv3-prod/
node build.js --dev  # dev build with sourcemaps → build/chrome-mv3-dev/
```
Extension requires its own `extension/.env`:
```
EXT_SUPABASE_URL=
EXT_SUPABASE_ANON_KEY=
```
After modifying `interceptor.ts`, user MUST reload extension at `chrome://extensions`.

### Python Worker (backend/)
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python main.py    # starts FastAPI server on port 8000
```

## Environment Setup

Root `.env` (see `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
`VITE_GEMINI_API_KEY` is in `.env.example` but must NOT be used on the frontend — all AI calls go through Supabase Edge Functions.

Edge Functions (set in Supabase dashboard):
- `WORKSPACE_AES_SECRET` — 32-char key for AES-GCM credential encryption
- `LOGIN_WORKER_URL` — URL of the Render Playwright worker

Python worker `backend/.env`:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role; bypasses RLS)
- `WORKSPACE_AES_SECRET` — same 32-char key as above
- `GEMINI_API_KEY`, `SCRAPER_API_KEY` (optional), `PORT` (default 8000)

## Path Alias
`@/` resolves to `src/` (configured in `vite.config.js`).

## Architecture

### Auth & Workspace Bootstrap
`App.jsx` bootstraps auth on mount via `supabase.auth.getSession()` + `onAuthStateChange`, writing to `useAuthStore` (Zustand, not persisted). `useWorkspaceStore` (Zustand, persisted to localStorage as `linkedpilot-workspace`) holds the active `workspaceId`. Every Supabase query must be filtered by `workspaceId` from this store.

### Data Layer
- `src/lib/supabase.js` — singleton Supabase client
- `src/lib/queryClient.js` — TanStack Query client (5-min stale time, 1 retry)
- All server state lives in `src/hooks/` as TanStack Query hooks (useQuery / useMutation)
- **Exception:** Realtime subscriptions use raw `useState`/`useEffect` (see `useActionQueue.js`) because TanStack Query doesn't manage WebSocket channels
- Unipile integration hooks: `useUnipileAccounts`, `useUnipileMessaging`, `useUnipileSearch`, `useUnipileProfiles`, `useUnipilePosts`, `useUnipileInvitations`

### Supabase Edge Functions
Located in `supabase/functions/<name>/index.ts`, written in Deno. Each function:
1. Validates the caller's JWT via `supabase.auth.getUser()`
2. Looks up `team_members` to resolve `workspace_id`
3. Returns CORS headers for all responses (including OPTIONS preflight)

Boilerplate template:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: { user } } = await supabase.auth.getUser(
    req.headers.get('authorization')?.split(' ')[1] || ''
  )
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
})
```

### Database Schema (key tables)
`workspaces` → root tenant; all other tables FK to it  
`team_members` — workspace users; `role`: owner | admin | member | viewer  
`linkedin_accounts` — connected LinkedIn seats; `login_method`: extension | cookies | credentials; credentials are AES-GCM encrypted (`li_email_enc`, `li_password_enc`); `status`: pending | active | warming | paused | disconnected | error  
`leads` — prospect records; `connection_status`: none | pending | connected | ignored  
`campaigns` — outreach campaigns with React Flow sequence JSON  
`campaign_enrollments` — lead-campaign junction; `status`, `current_step`  
`action_queue` — pending actions dispatched to workers/extension  
`actions_log` — immutable completed action history (used for daily stats/charts)  
`messages` — Unibox conversation threads; `direction`: inbound | outbound  
`workspace_settings` — per-workspace config (upserted, not inserted)

Full schema: `supabase/schema.sql`. RLS policies: `supabase/rls.sql`.

AES-GCM encryption format (shared between Edge Functions and Python worker): `iv_base64:content_base64:auth_tag_base64`  
Implementation: `supabase/functions/_shared/crypto.ts` ↔ `backend/utils/crypto.py`

### LinkedIn Account Connection Methods

| Type | How it connects | Action execution |
|---|---|---|
| `credentials` | Email + password; cloud Playwright on Render | Render Playwright worker (no extension needed) |
| `extension` | `li_at` cookie extracted live from browser | Chrome Extension via Supabase Realtime channel |
| `cookies` | Manual cookie paste by user | Chrome Extension via Supabase Realtime channel |

Never route a credentials action through the extension, or vice versa.

### Chrome Extension Architecture

Three content scripts, two worlds:

| File | World | Purpose |
|------|-------|---------|
| `contents/interceptor.ts` | **MAIN** | Intercepts XHR/fetch to capture LinkedIn's internal Voyager API |
| `contents/linkedin.ts` | **ISOLATED** | Receives intercepted data, executes actions, talks to background |
| `contents/dashboard.ts` | ISOLATED | Web app ↔ extension bridge; syncs Supabase session tokens to extension storage |

Data flow: LinkedIn page XHR → interceptor.ts captures → `postMessage("VOYAGER_EXTRACT")` → linkedin.ts buffers in `voyagerBuffer` → action handler reads buffer or falls back to DOM.

`background.ts` is the extension hub: manages Realtime subscription, action queue polling (1-min alarm fallback), and navigation state machine (`pendingAction → navigate → waitForNavigationAndRetry → execute`).

Supported action types in `linkedin.ts:handleAction()`: `scrapeLeads`, `viewProfile`, `sendConnectionRequest`, `sendMessage`.

### Python Worker (backend/)
FastAPI HTTP service on Render. Handles all `credentials` login_method actions.

Flow:
1. Edge Function inserts action into `action_queue` (`status='pending'`)
2. Edge Function POSTs `{ action_id }` to `LOGIN_WORKER_URL/process`
3. Worker fetches action, marks `processing`, runs Playwright, writes result to `action_queue` + `actions_log`
4. Up to `MAX_CONCURRENT_ACTIONS` (default 3) run in parallel via `asyncio.Semaphore`

Terminal errors (no retry): `ProfileNotFoundError`, `AccountRestrictedError`, `SessionExpiredError`  
Retryable errors: `ActionTimeoutError` + generic exceptions (exponential backoff, `5 * retries` seconds)

Key files:
- `backend/main.py` — FastAPI app, `/health` + `/process` endpoints, `run_action()` core logic
- `backend/scraper/engine.py` — `LinkedInScraper` (Playwright); cookie auth, credential login, profile scraping, connection requests
- `backend/utils/crypto.py` — AES-GCM decrypt matching Web Crypto format
- `backend/utils/db.py` — Supabase client using service role key (bypasses RLS)
- `backend/utils/ai_parser.py` — Gemini Flash for structured lead data extraction
- `backend/utils/discovery.py` — yfinance + DuckDuckGo for lead enrichment

The worker uses the service role key — all incoming requests should come from Supabase Edge Functions only.

## Design System
- Dark theme: bg-[#0f0f0f], sidebar bg-[#1a1a1a], cards bg-[#1e1e1e]
- Primary color: #7c3aed (purple)
- Text: white primary, #94a3b8 secondary
- Borders: border-white/5
- All UI components from shadcn/ui (wrappers in `src/components/ui/`)

## Sidebar Navigation (exact order)
Dashboard → /dashboard  
Unibox → /inbox  
CAMPAIGNS: LinkedIn Accounts → /linkedin-accounts, Campaigns → /campaigns, Lead Extractor → /lead-extractor, Lead Database → /leads  
AUTOMATIONS: Content Assistant → /content, Inbound Automations → /inbound  
GENERAL: Settings → /settings

## Key Rules
- All components are functional (no class components)
- All Supabase calls go through TanStack Query hooks in `src/hooks/`
- All forms use React Hook Form + Zod
- All API/AI calls go through Supabase Edge Functions (never call Gemini directly from frontend)
- Keep components under 200 lines — split if larger
- Always filter Supabase queries by `workspace_id` from Zustand store
- Extension cannot write to Supabase directly — must go through Edge Functions

## How to Add a New Action Type
1. Add to `action_queue.action_type` enum in `supabase/schema.sql`
2. Implement handler in `extension/contents/linkedin.ts:handleAction()`
3. Implement handler in `backend/scraper/engine.py:_execute_action()`
4. Add UI trigger in appropriate page component

## Hot Files

| Path | When to edit |
|------|-------------|
| `src/App.jsx` | Add/remove routes |
| `src/hooks/useCampaigns.js` | Campaign CRUD + stats |
| `src/hooks/useLeads.js` | Lead filtering/scoring |
| `extension/contents/interceptor.ts` | Add new data sources (reload extension after) |
| `extension/contents/linkedin.ts` | New automation actions |
| `extension/contents/dashboard.ts` | Web app ↔ extension auth bridge |
| `extension/background.ts` | Navigation, Realtime, polling |
| `backend/main.py` | Action dispatch logic |
| `backend/scraper/engine.py` | New Playwright scraper methods |
| `supabase/schema.sql` | New tables/columns |
| `supabase/functions/queue-action/index.ts` | Action queue insertion logic |
| `supabase/functions/process-campaign/index.ts` | Campaign DAG walker, action population |

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
