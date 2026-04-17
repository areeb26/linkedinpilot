# AGENT.MD - LinkedPilot OS

**Last Updated:** April 2026  
**Purpose:** Operational manual and "Truth Engine" for AI agents working on LinkedPilot. Complements `CLAUDE.md` with deep-dive technical protocols.

---

## 1. System Architecture

LinkedPilot is a **three-tier LinkedIn automation SaaS**:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Dashboard     │────▶│  Supabase Cloud  │◀────│  Python Worker  │
│  (React + Vite) │     │ (Postgres + Edge │     │ (Playwright on  │
│                 │◀────│    Functions)    │────▶│     Render)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │              ┌────────▼────────┐
         │              │ Chrome Extension│
         └─────────────▶│  (Content Script) │
                        └─────────────────┘
```

### 1.1 Tier Responsibilities

| Tier | Tech | Responsibility |
|------|------|--------------|
| **Frontend** | React 19, Vite, TanStack Query | UI, state management, campaign builder |
| **Edge Functions** | Deno (Supabase) | Auth, encryption, orchestration, AI proxy |
| **Python Worker** | FastAPI + Playwright | Cloud browser automation for credentials accounts |
| **Extension** | Vanilla TS + esbuild | In-browser action execution, API interception |

---

## 2. Database Schema (Critical Tables)

**Location:** `supabase/schema.sql`

### 2.1 Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `workspaces` | Root tenant | `id`, `name`, `slug`, `plan`, `owner_id` |
| `team_members` | Workspace users | `workspace_id`, `user_id`, `role` (owner/admin/member/viewer) |
| `linkedin_accounts` | Connected seats | `workspace_id`, `status`, `login_method`, encrypted creds |
| `leads` | Prospects | `workspace_id`, `profile_url` (unique), `connection_status` |
| `campaigns` | Outreach sequences | `workspace_id`, `sequence_json`, `status` |
| `campaign_enrollments` | Lead-campaign junction | `campaign_id`, `lead_id`, `status`, `current_step` |
| `action_queue` | Pending actions | `workspace_id`, `action_type`, `status`, `payload` |
| `actions_log` | Audit trail | Immutable history of all executed actions |
| `messages` | Unibox | `workspace_id`, `thread_id`, `direction` (inbound/outbound) |

### 2.2 Key Constraints

```sql
-- Lead upsert uniqueness
CREATE UNIQUE INDEX leads_workspace_profile_url_unique 
ON leads(workspace_id, profile_url);

-- Action queue efficient polling
CREATE INDEX idx_action_queue_pending 
ON action_queue(linkedin_account_id, scheduled_at) 
WHERE status = 'pending';
```

### 2.3 RLS Policies

**Rule:** Every table has `workspace_select` and `workspace_mutate` policies filtering by `auth_user_workspace_ids()`.

**Critical:** Extension CANNOT write directly - must use Edge Functions with service role key.

---

## 3. LinkedIn Account Connection Methods

**Location:** `extension/contents/linkedin.ts:153`, `backend/main.py:153`

### 3.1 Three Login Methods

| Method | Credential Storage | Execution Path |
|--------|-------------------|----------------|
| `extension` | Live `li_at` cookie | Extension via Realtime channel |
| `cookies` | Pasted cookie string | Extension via Realtime channel |
| `credentials` | AES-GCM encrypted email/password | Python worker on Render |

### 3.2 Encryption Format

**Location:** `supabase/functions/_shared/crypto.ts`, `backend/utils/crypto.py`

Format: `iv_base64:content_base64:auth_tag_base64`
- Uses AES-GCM with 32-byte `WORKSPACE_AES_SECRET`
- Web Crypto in Edge Functions matches Python cryptography library

### 3.3 Action Routing Rules

**CRITICAL:** Never route credentials actions through extension or vice versa.

```typescript
// Edge Function logic (queue-action/index.ts:57)
if (account?.login_method === 'credentials' && worker_url) {
  fetch(`${worker_url}/process`, { body: JSON.stringify({ action_id }) })
}
```

---

## 4. Extension Architecture

**Location:** `extension/`

### 4.1 Content Script Worlds

| File | World | Purpose |
|------|-------|---------|
| `interceptor.ts` | **MAIN** | Intercepts XHR/fetch to capture LinkedIn's internal API |
| `linkedin.ts` | **ISOLATED** | Receives intercepted data, executes actions, talks to background |

### 4.2 Data Flow (Interception)

```
LinkedIn Page (MAIN world)
    ↓ XHR/Fetch
interceptor.ts captures → postMessage("VOYAGER_EXTRACT")
    ↓
linkedin.ts (ISOLATED world) listens → buffers in voyagerBuffer
    ↓
Action handler reads buffer or falls back to DOM scraping
```

### 4.3 Voyager Buffer Structure

**Location:** `extension/contents/linkedin.ts:13`

```typescript
const voyagerBuffer = {
  search: [],      // Populated by handleSearchData, handleGraphQLData
  profiles: Map,   // Populated by handleProfileData
  comments: [],    // Populated by handleCommentsData
  reactions: [],   // Populated by handleReactionsData
  connections: []  // Populated by handleConnectionsData
};
```

### 4.4 Action Execution

**Location:** `extension/contents/linkedin.ts:366`

Supported actions:
- `scrapeLeads` - type: 'search' | 'comments' | 'reactions' | 'groups' | 'events' | 'network'
- `viewProfile` - Navigate and extract
- `sendConnectionRequest` - With optional note
- `sendMessage` - Via internal API or UI

### 4.5 Navigation Resilience

**Location:** `extension/background.ts`

```typescript
// State machine for actions requiring navigation
pendingAction → navigate → waitForNavigationAndRetry → execute
```

---

## 5. Python Worker (FastAPI)

**Location:** `backend/main.py`, `backend/scraper/engine.py`

### 5.1 Architecture

```python
# FastAPI app with async semaphore for concurrency
semaphore = asyncio.Semaphore(MAX_CONCURRENT)  # Default: 3

@app.post("/process")
async def process_endpoint(req: ProcessRequest):
    background_tasks.add_task(run_action, req.action_id)
    return {"status": "accepted"}
```

### 5.2 Action Execution Flow

1. Fetch action + linkedin_account join
2. Mark `status = 'processing'`
3. `_setup_session()` - decrypt credentials or set cookies
4. `_execute_action()` - dispatch to scraper method
5. Write result to `action_queue` + `actions_log`

### 5.3 Retry Logic

**Location:** `backend/main.py:99`

```python
while retries <= MAX_RETRIES and not success:
    try:
        result = await _execute_action(action)
        # Mark done
    except (ProfileNotFoundError, AccountRestrictedError, SessionExpiredError) as e:
        # Terminal error - no retry
        await _log_failed_action(supabase, action, str(e))
        return
    except Exception as e:
        # Retryable error
        retries += 1
        await asyncio.sleep(5 * retries)
```

### 5.4 Scraper Methods

**Location:** `backend/scraper/engine.py`

| Method | Purpose |
|--------|---------|
| `scrape_profile(url)` | Extract name, headline, company |
| `send_connection_request(url, message)` | Click connect, add note, send |
| `send_message(url, message)` | Open messenger, type, send |
| `scrape_leads_batch(search_url, max)` | Scroll search, extract leads |

---

## 6. Frontend Patterns

**Location:** `src/`

### 6.1 State Management

| Store | Type | Purpose |
|-------|------|---------|
| `authStore.js` | Zustand (non-persisted) | User session, login/logout |
| `workspaceStore.js` | Zustand (persisted) | Active workspace ID + name |

### 6.2 Data Fetching Pattern

**Location:** `src/hooks/useCampaigns.js`, `src/hooks/useLeads.js`

```javascript
export function useCampaigns() {
  const { workspaceId } = useWorkspaceStore()
  
  return useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)  // ALWAYS filter by workspace
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!workspaceId
  })
}
```

### 6.3 Optimistic Updates

**Location:** `src/hooks/useLeads.js:118`

```javascript
onMutate: async (updatedLead) => {
  await queryClient.cancelQueries({ queryKey: ['leads'] })
  const previousLeads = queryClient.getQueryData(['leads'])
  
  queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => ({
    ...old,
    data: old.data.map(lead => 
      lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
    )
  }))
  
  return { previousLeads }  // For rollback on error
}
```

### 6.4 Route Structure

**Location:** `src/App.jsx:106`

```
/auth                  → Auth page
/dashboard             → Dashboard with stats
/inbox                 → Unibox (messages)
/linkedin-accounts     → Connected accounts
/campaigns             → Campaign list
/campaigns/new         → Campaign builder
/campaigns/:id         → Edit campaign
/lead-extractor       → Lead extraction wizard
/leads                 → Lead database
/content               → Content assistant
/inbound               → Inbound automations
/settings              → Workspace settings
```

---

## 7. Design System

### 7.1 Color Palette

```css
--background: #0f0f0f       /* Main bg */
--card: #1a1a1a, #1e1e1e    /* Cards, sidebar */
--primary: #7c3aed          /* Purple accent */
--text-primary: white
--text-secondary: #94a3b8
--border: border-white/5
```

### 7.2 Component Sources

- **UI Base:** shadcn/ui (18 components in `src/components/ui/`)
- **Custom:** `StatCard`, `ActivityChart`, `LeadExtractorWizard`, `CampaignCard`

---

## 8. Development Workflows

### 8.1 Commands

```bash
# Start development (frontend + backend)
npm run dev

# Frontend only
npm run dev:ui

# Backend only
npm run dev:backend

# Production build
npm run build

# Lint (zero warnings policy)
npm run lint
```

### 8.2 Extension Development

**CRITICAL:** After modifying `interceptor.ts`, user MUST reload extension at `chrome://extensions`.

```bash
# Build extension
cd extension && node build.js

# Load unpacked in Chrome
# Select extension/ directory
```

### 8.3 Database Migrations

**Location:** `supabase/migrations/`

- Use sequential naming: `20260415_description.sql`
- Always include `workspace_id` references for RLS
- Create indexes for new foreign keys

---

## 9. Agent Behavioral Rules

### 9.1 Absolute Rules

1. **Workspace Isolation:** Every Supabase query MUST include `.eq('workspace_id', workspaceId)`
2. **No Direct AI Calls:** Frontend → Edge Function → Gemini (never direct)
3. **No Extension Direct Writes:** Extension → Edge Function → Supabase (service role)
4. **Credential Encryption:** Always use AES-GCM, never plaintext
5. **Interceptor Reload:** Remind user to reload extension after interceptor changes

### 9.2 Code Style

- **Functional components only** (no class components)
- **Max 200 lines per component** - split if larger
- **Use TanStack Query for all server state**
- **Use React Hook Form + Zod for all forms**
- **Path alias:** `@/` resolves to `src/`

### 9.3 Error Handling

```javascript
// Backend: Custom exceptions with retry logic
class LinkedInError extends Exception { }
class ProfileNotFoundError extends LinkedInError { }  // Terminal
class AccountRestrictedError extends LinkedInError { } // Terminal
class SessionExpiredError extends LinkedInError { }    // Terminal
class ActionTimeoutError extends LinkedInError { }     // Retryable

// Frontend: Toast notifications via react-hot-toast
toast.success('Action completed')
toast.error(`Error: ${error.message}`)
```

---

## 10. Common Tasks

### 10.1 Add New Action Type

1. Add to `action_queue.action_type` enum in schema
2. Implement handler in `extension/contents/linkedin.ts:handleAction()`
3. Implement handler in `backend/scraper/engine.py:_execute_action()`
4. Add UI trigger in appropriate page component

### 10.2 Add New Edge Function

1. Create `supabase/functions/function-name/index.ts`
2. Use template:
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
  
  // Validate user
  const { data: { user } } = await supabase.auth.getUser(
    req.headers.get('authorization')?.split(' ')[1] || ''
  )
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  
  // Implementation
  
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
})
```

### 10.3 Add New Database Table

1. Add CREATE TABLE to `supabase/schema.sql`
2. Add `workspace_id` foreign key
3. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. Add policies: `workspace_select`, `workspace_mutate`
5. Add `updated_at` trigger
6. Create migration file

---

## 11. Project Status (April 2026)

| Feature | Status |
|---------|--------|
| Auth + Workspace system | ✅ Complete |
| LinkedIn account connection (3 methods) | ✅ Complete |
| Lead extraction wizard | ✅ Complete |
| Campaign builder (React Flow) | ✅ Complete |
| Action queue with Realtime | ✅ Complete |
| Python Playwright worker | ✅ Complete |
| Chrome Extension with Voyager interception | ✅ Complete |
| Unibox (Inbox) | ✅ Complete |
| Dashboard analytics | ⚠️ Static data (needs backend) |
| Lead enrichment (education, certs) | ⚠️ UI placeholders |
| Credential account warm-up | 🚧 Pending |

---

## 12. Hot Files Reference

| Path | Purpose | When to Edit |
|------|---------|--------------|
| `src/App.jsx` | Route definitions, auth bootstrap | Add/remove pages |
| `src/hooks/useCampaigns.js` | Campaign CRUD + stats | Campaign logic changes |
| `src/hooks/useLeads.js` | Lead management | Lead filtering/scoring |
| `extension/contents/interceptor.ts` | API interception | Add new data sources |
| `extension/contents/linkedin.ts` | Action execution | New automation actions |
| `extension/background.ts` | Extension hub | Navigation, Realtime |
| `backend/main.py` | Worker orchestration | Action dispatch logic |
| `backend/scraper/engine.py` | Playwright automation | New scraper methods |
| `supabase/schema.sql` | Database schema | New tables/columns |
| `supabase/functions/queue-action/index.ts` | Action insertion | Queue logic changes |
