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
- Chrome Extension: Vanilla esbuild (Manifest V3) — migrated away from Plasmo
- Payments: Stripe
- Deploy: Vercel (frontend) + Supabase (backend) + Render (Python worker)

## Dev Commands

### Frontend
```bash
npm run dev       # start Vite dev server
npm run build     # production build
npm run lint      # ESLint (zero warnings policy)
npm run preview   # preview production build
```

### Python Worker (backend/)
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python main.py    # starts FastAPI server on port 8000
```

## Environment Setup
Create `.env` at the project root (see `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
`VITE_GEMINI_API_KEY` is in `.env.example` but should NOT be used on the frontend — all AI calls go through Supabase Edge Functions.

Edge Functions additionally require (set in Supabase dashboard):
- `WORKSPACE_AES_SECRET` — 32-char key for AES-GCM credential encryption
- `LOGIN_WORKER_URL` — URL of the Render Playwright worker (e.g. `https://your-worker.onrender.com`)

Python worker (`backend/.env`):
- `SUPABASE_URL` — same as frontend but without VITE_ prefix
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (bypasses RLS; never expose to frontend)
- `WORKSPACE_AES_SECRET` — same 32-char key as above
- `GEMINI_API_KEY` — for AI parsing in the worker
- `SCRAPER_API_KEY` — ScraperAPI proxy key (optional)
- `PORT` — HTTP port (default 8000; Render sets this automatically)

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

### Supabase Edge Functions
Located in `supabase/functions/<name>/index.ts`, written in Deno. Each function:
1. Validates the caller's JWT via `supabase.auth.getUser()`
2. Looks up `team_members` to resolve `workspace_id`
3. Returns CORS headers for all responses (including OPTIONS preflight)

### Database Schema (key tables)
`workspaces` → root tenant; all other tables FK to it  
`team_members` — workspace users; `role`: owner | admin | member | viewer  
`linkedin_accounts` — connected LinkedIn seats; `login_method`: extension | cookies | credentials; credentials are AES-GCM encrypted (`li_email_enc`, `li_password_enc`); `status`: pending | active | warming | paused | disconnected | error  
`leads` — prospect records; `connection_status`: none | pending | connected | ignored  
`campaigns` — outreach campaigns with React Flow sequence JSON  
`action_queue` — pending actions dispatched to workers/extension  
`actions_log` — completed action history (used for daily stats/charts)  
`messages` — Unibox conversation threads  
`workspace_settings` — per-workspace config (upserted, not inserted)

Full schema: `supabase/schema.sql`. RLS policies: `supabase/rls.sql`.

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

## LinkedIn Account Connection Methods
Three `login_method` types — determines where actions execute:

| Type | How it connects | Action execution |
|---|---|---|
| `credentials` | Email + password; cloud Playwright on Render | Render Playwright worker (no extension needed) |
| `extension` | `li_at` cookie extracted live from browser | Chrome Extension via Supabase Realtime channel |
| `cookies` | Manual cookie paste by user | Chrome Extension via Supabase Realtime channel |

- Credentials accounts: Edge Function encrypts creds (AES-GCM) → stores in `linkedin_accounts` → pings Render worker via `LOGIN_WORKER_URL`
- Extension/Cookie accounts: Edge Function publishes action to Realtime channel → Extension subscribes, executes, posts result back
- Never route a credentials action through the extension, or vice versa

### Python Worker (backend/)
The Python worker is a **FastAPI HTTP service** deployed on Render. It handles all `credentials` login_method actions — Playwright browser automation that can't run in the browser extension or Deno Edge Functions.

**Flow:**
1. Supabase Edge Function inserts an action into `action_queue` with `status='pending'`
2. Edge Function POSTs `{ action_id }` to `LOGIN_WORKER_URL/process`
3. Worker fetches the action, marks it `processing`, runs Playwright, writes result back to `action_queue` + `actions_log`
4. Up to `MAX_CONCURRENT_ACTIONS` (default 3) actions run in parallel via `asyncio.Semaphore`

**Files:**
- `backend/main.py` — FastAPI app, `/health` + `/process` endpoints, `run_action()` core logic
- `backend/scraper/engine.py` — `LinkedInScraper` class (Playwright); handles cookie auth, credential login, profile scraping, connection requests
- `backend/utils/crypto.py` — AES-GCM decrypt/encrypt matching the Web Crypto format used by Edge Functions
- `backend/utils/db.py` — Supabase client using service role key (bypasses RLS)
- `backend/utils/ai_parser.py` — Gemini Flash for extracting structured lead data from raw scraped text
- `backend/utils/discovery.py` — yfinance (financial data) + DuckDuckGo (procurement portal discovery)

**Key constraint:** The worker uses the **service role key** — it must never be exposed to the frontend. All incoming requests to the worker should be from Supabase Edge Functions only.

## Key Rules
- All components are functional (no class components)
- All Supabase calls go through TanStack Query hooks in `src/hooks/`
- All forms use React Hook Form + Zod
- All API/AI calls go through Supabase Edge Functions (never call Gemini directly from frontend)
- Keep components under 200 lines — split if larger
- Always filter Supabase queries by `workspace_id` from Zustand store

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
