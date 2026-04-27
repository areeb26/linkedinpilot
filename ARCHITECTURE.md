# LinkedPilot Architecture

## Overview

LinkedPilot consists of **3 separate processes** that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                      LinkedPilot System                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   Backend    │  │    Worker    │      │
│  │   (Vite)     │  │  (FastAPI)   │  │   (Python)   │      │
│  │  Port 5174   │  │  Port 3000   │  │  Background  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │   Supabase     │                       │
│                    │   (Database)   │                       │
│                    └────────────────┘                       │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  Unipile API   │                       │
│                    │  (LinkedIn)    │                       │
│                    └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Frontend (Vite + React)
**Port:** 5174  
**Purpose:** User interface  
**Technology:** React, Vite, TailwindCSS

**Responsibilities:**
- Display campaigns, leads, analytics
- User interactions (create campaigns, upload leads, etc.)
- Real-time updates via React Query
- Communicates with Backend API

**Files:**
- `src/` - React components, pages, hooks
- `index.html` - Entry point
- `vite.config.js` - Vite configuration

---

### 2. Backend (FastAPI)
**Port:** 3000  
**Purpose:** REST API server  
**Technology:** Python, FastAPI

**Responsibilities:**
- Handle API requests from frontend
- CRUD operations (campaigns, leads, accounts)
- Queue actions to `action_queue` table
- Serve as middleware between frontend and database
- Does NOT execute LinkedIn actions directly

**Files:**
- `backend/main.py` - FastAPI server
- `backend/utils/` - Utility functions

**Key Endpoints:**
- `POST /queue-action` - Queue a connection request
- `GET /campaigns` - Fetch campaigns
- `POST /campaigns` - Create campaign
- etc.

---

### 3. Worker (Python Background Process)
**Port:** None (background process)  
**Purpose:** Execute LinkedIn actions  
**Technology:** Python, AsyncIO

**Responsibilities:**
- Poll `action_queue` table every 10 seconds
- Execute pending actions (send connections, messages)
- Communicate with Unipile API
- Update action status (pending → processing → done/failed)
- Log results to `actions_log` table
- Enforce rate limits (daily/weekly)
- Add natural delays between actions (30-90s)

**Files:**
- `backend/worker.py` - Main worker loop
- `backend/utils/action_runner.py` - Action execution logic
- `backend/utils/rate_limiter.py` - Rate limiting
- `backend/utils/unipile.py` - Unipile API client

**Important:** The worker is **completely separate** from the backend API. It runs independently and processes actions asynchronously.

---

## Data Flow

### Example: Sending a Connection Request

```
1. User clicks "Connect" button in Frontend
   ↓
2. Frontend calls Backend API: POST /queue-action
   ↓
3. Backend inserts action into action_queue table
   {
     action_type: 'connect',
     status: 'pending',
     lead_id: '...',
     campaign_id: '...',
     linkedin_account_id: '...'
   }
   ↓
4. Backend returns success to Frontend
   ↓
5. Worker polls action_queue (every 10s)
   ↓
6. Worker finds pending action
   ↓
7. Worker checks rate limits
   ↓
8. Worker calls Unipile API to send connection
   ↓
9. Worker updates action status to 'done'
   ↓
10. Worker logs result to actions_log table
   ↓
11. Worker updates lead connection_status to 'pending'
   ↓
12. Frontend polls and shows updated status
```

---

## Why Are They Separate?

### Backend vs Worker Separation

**Backend (FastAPI):**
- Handles HTTP requests (fast, synchronous)
- Returns immediately to user
- Doesn't wait for LinkedIn actions to complete
- Stateless, can scale horizontally

**Worker (Background Process):**
- Long-running process
- Executes actions asynchronously
- Handles rate limiting and delays
- Can retry failed actions
- Doesn't block user requests

**Benefits:**
✅ User doesn't wait for LinkedIn API calls  
✅ Actions can be retried if they fail  
✅ Rate limiting is centralized  
✅ Natural delays between actions  
✅ Backend stays responsive  

---

## Running the System

### Development Mode

**Option 1: All-in-One (Recommended)**
```bash
npm run dev
```
This starts all 3 processes:
- Frontend (Vite) - cyan
- Backend (FastAPI) - green  
- Worker (Python) - yellow

**Option 2: Separate Terminals**
```bash
# Terminal 1: Frontend
npm run dev:ui

# Terminal 2: Backend
npm run dev:backend

# Terminal 3: Worker
npm run dev:worker
```

### Production Mode

```bash
# Frontend (build and serve)
npm run build
npm run preview

# Backend (with gunicorn)
gunicorn backend.main:app --workers 4 --bind 0.0.0.0:3000

# Worker (with supervisor or systemd)
python backend/worker.py
```

---

## Database Tables

### action_queue
Stores pending/processing actions
- `id` - UUID
- `action_type` - 'connect', 'message', 'like', etc.
- `status` - 'pending', 'processing', 'done', 'failed'
- `lead_id` - Reference to lead
- `campaign_id` - Reference to campaign
- `linkedin_account_id` - Account to use
- `payload` - Action-specific data
- `created_at` - When queued
- `started_at` - When processing started
- `scheduled_for` - When to execute (for delays)

### actions_log
Audit trail of completed actions
- `id` - UUID
- `action_type` - Type of action
- `status` - 'done' or 'failed'
- `lead_id` - Reference to lead
- `campaign_id` - Reference to campaign
- `error_message` - If failed
- `created_at` - When completed

### leads
Lead information
- `id` - UUID
- `full_name` - Lead name
- `profile_url` - LinkedIn URL
- `linkedin_member_id` - Unipile provider_id (required!)
- `connection_status` - 'none', 'pending', 'connected', 'failed'
- `campaign_id` - Associated campaign

---

## Important Notes

### Lead Enrichment
Before sending connections, leads MUST have `linkedin_member_id`:

```bash
python backend/enrich_leads.py
```

This fetches the Unipile `provider_id` from LinkedIn profile URLs.

### Monitoring

Check worker status:
```bash
python backend/check_status.py
```

Shows:
- Action queue status
- Rate limit usage
- Recent actions
- Errors

### Rate Limits

**Daily Limits (per account):**
- Connections: 20/day
- Messages: 50/day

**Weekly Limits:**
- Connections: 200/week

The worker enforces these automatically.

---

## Troubleshooting

### Worker Not Processing Actions?

1. Check if worker is running:
   ```bash
   # Windows
   Get-Process | Where-Object {$_.ProcessName -like "*python*"}
   
   # Linux/Mac
   ps aux | grep worker
   ```

2. Check worker logs (if running via npm run dev)

3. Check action_queue for stuck actions:
   ```bash
   python backend/check_status.py
   ```

### Actions Failing?

1. Check if leads have `linkedin_member_id`:
   ```bash
   python backend/check_lead_data.py
   ```

2. Run enrichment if missing:
   ```bash
   python backend/enrich_leads.py
   ```

3. Check Unipile API credentials in `.env`

### Backend Not Starting?

1. Check if port 3000 is already in use
2. Check `.env` file exists with Supabase credentials
3. Check Python dependencies installed: `pip install -r backend/requirements.txt`

---

## Summary

**3 Processes:**
1. **Frontend** (Vite) - User interface on port 5174
2. **Backend** (FastAPI) - API server on port 3000
3. **Worker** (Python) - Background job processor

**They communicate via:**
- Frontend ↔ Backend: HTTP REST API
- Backend ↔ Database: Supabase client
- Worker ↔ Database: Supabase client (polls action_queue)
- Worker ↔ LinkedIn: Unipile API

**To run everything:**
```bash
npm run dev
```

That's it! 🚀
