# LinkedPilot — AI Context & Instruction Manual

LinkedPilot is a LinkedIn automation SaaS (a clone of SendPilot.ai) designed for B2B agencies and sales teams to automate LinkedIn outreach. This document serves as the foundational instruction set for AI agents working on this codebase.

## 🚀 Project Overview

LinkedPilot enables users to manage multiple LinkedIn accounts, build outreach campaigns with a visual sequence builder, and automate actions like profile views, connection requests, and messaging.

- **Frontend:** React 19 + Vite (SPA)
- **Backend:** Supabase (Postgres, Auth, Edge Functions, Realtime)
- **Automation:** 
  - **Cloud:** Python (FastAPI + Playwright) worker for cloud-based automation.
  - **Local:** Chrome Extension (Manifest V3) for browser-based automation.
- **AI:** Google Gemini 1.5 Pro (via Supabase Edge Functions) for lead parsing and content generation.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, React Router v6, Tailwind CSS, shadcn/ui |
| **State Management** | Zustand (Global/UI), TanStack Query (Server State) |
| **Forms** | React Hook Form + Zod |
| **Visuals** | Recharts (Analytics), React Flow (Campaign Builder) |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Worker (Python)** | FastAPI, Playwright, Gemini Flash (Parsing) |
| **Extension** | Vanilla JS/TS, esbuild, Manifest V3 |

---

## 🏗 Architecture & Data Flow

### 1. Multi-Tenant Workspace System
- Every user belongs to one or more `workspaces`.
- All data tables (leads, campaigns, accounts) **MUST** be filtered by `workspace_id`.
- `useWorkspaceStore` (Zustand) manages the active `workspace_id`.

### 2. LinkedIn Account Connectivity
Actions are routed based on the `login_method` of the `linkedin_account`:
- **`credentials`**: Handled by the **Python Worker** (Playwright in the cloud).
- **`extension` / `cookies`**: Handled by the **Chrome Extension** via Supabase Realtime channels.

### 3. Action Queue System
1. An action (e.g., "Connect") is inserted into the `action_queue` table.
2. If `credentials`, a Supabase Edge Function pings the Python Worker.
3. If `extension`, the Extension picks up the action via a Realtime subscription.
4. Results are written back to `action_queue` and logged to `actions_log`.

### 4. Security
- **Credentials:** LinkedIn emails/passwords are AES-GCM encrypted using `WORKSPACE_AES_SECRET`.
- **Row Level Security (RLS):** Enabled on all Supabase tables. Frontend uses the `anon` key; Python worker uses the `service_role` key.

---

## 💻 Development Commands

### Frontend & Overall Dev
```bash
npm run dev       # Start Vite + Backend concurrently
npm run dev:ui    # Start Vite only
npm run build     # Production build
npm run lint      # ESLint (Zero warnings policy)
```

### Python Worker (backend/)
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python main.py    # Starts FastAPI on port 8000
```

### Supabase
```bash
supabase start    # Start local Supabase (if configured)
supabase edge function deploy <name>
```

---

## 📏 Development Conventions

1. **Surgical Components:** Keep components under 200 lines. Split into smaller units if they grow larger.
2. **Data Fetching:** Use TanStack Query hooks located in `src/hooks/`. Never call Supabase directly from UI components.
3. **AI Integration:** All AI calls **MUST** go through Supabase Edge Functions. Never expose API keys or call Gemini directly from the frontend.
4. **Styling:** Adhere to the "Dark Mode" design system:
   - Background: `bg-[#0f0f0f]`
   - Sidebar: `bg-[#1a1a1a]`
   - Primary: `#7c3aed` (Purple)
   - Border: `border-white/5`
5. **Path Aliases:** Use `@/` to reference the `src/` directory.
6. **Zero Warnings:** The `npm run lint` command must pass with zero warnings before any merge.

---

## 📂 Key Directory Structure

- `src/components/`: UI components (shadcn/ui in `/ui`).
- `src/hooks/`: All TanStack Query hooks for data fetching.
- `src/lib/`: Singletons (Supabase client, Query client).
- `backend/`: Python Playwright worker.
- `extension/`: Chrome extension source.
- `supabase/functions/`: Deno Edge Functions.
- `supabase/migrations/`: Database schema and RLS policies.

---

## 🤖 Knowledge Graph (graphify)
This project uses `graphify` for architectural mapping.
- **Report:** `graphify-out/GRAPH_REPORT.md`
- **Rule:** Run `graphify update .` after significant code changes to maintain the knowledge graph.
