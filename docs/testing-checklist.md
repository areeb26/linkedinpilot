# LinkedPilot — Full Testing Checklist

## 🔐 Authentication

- [ ] Sign up with email/password
- [ ] Log in / log out
- [ ] Workspace is created and selected on first login

---

## 👤 LinkedIn Accounts (`/linkedin-accounts`)

- [ ] Add Account → Hosted Auth — opens account.unipile.com, login completes, account appears in table with "Connected" status
- [ ] Add Account → Credentials — enter email/password, handles 2FA/OTP checkpoint, account connects
- [ ] Add Account → Cookies — paste `li_at` cookie, account connects
- [ ] Sync Profile — click ⋮ → Sync Profile → real name, photo, headline appear in the row
- [ ] Reconnect — click ⋮ → Reconnect → shows success toast
- [ ] Pause / Activate — click ⋮ → Pause → status changes to Paused; Activate → Active
- [ ] Remove — click ⋮ → Remove → account deleted from Unipile and Supabase
- [ ] Unipile Status badge — shows Connected / Reconnect Required / Error / Unknown correctly
- [ ] Last Sync — updates after Sync Profile
- [ ] Daily usage bars — show 0/limit correctly

---

## 📥 Inbox (`/inbox`)

- [ ] Chats load from Unipile (not Supabase)
- [ ] Search filters chats by name
- [ ] Click a chat → messages load in middle panel
- [ ] Right panel shows contact name, headline, avatar
- [ ] Send message — type and press Enter or click Send → message appears immediately (optimistic)
- [ ] AI suggest — click ✨ → suggestion pills appear → click pill to send
- [ ] File attachment — click 📎 → select file ≤10MB → file preview shows → send
- [ ] Error state shown when chats fail to load

---

## 🔍 Lead Extractor (`/lead-extractor`)

- [ ] Extraction history — existing extractions listed
- [ ] Search LinkedIn button → opens search view
- [ ] Tier selector — Classic / Sales Navigator / Recruiter tabs work
- [ ] Category selector — People / Companies / Posts / Jobs
- [ ] Search — enter keywords → results appear in table
- [ ] Load More — loads next page without resetting results
- [ ] View Source — opens LinkedIn URL
- [ ] Export — downloads CSV
- [ ] Add to Campaign — modal opens, select campaign, leads added
- [ ] `TIER_NOT_AVAILABLE` error shown for Sales Nav/Recruiter on free accounts

---

## 🗄️ Lead Database (`/leads`)

- [ ] Leads list loads with count
- [ ] Search — filters by name/company
- [ ] ICP filter — slider filters by score
- [ ] Status filter — filters by connection status
- [ ] View Profile — opens profile modal with photo, headline, location
- [ ] Send Invite — sends connection request, lead status updates to "invited"
- [ ] Send Message — compose modal opens, message sent via Unipile
- [ ] Delete lead — removes from list
- [ ] Bulk delete — select multiple → delete
- [ ] Import CSV — upload CSV → leads appear
- [ ] Export — downloads all leads as CSV
- [ ] Pagination works (Previous / Next)

---

## 📣 Campaigns (`/campaigns`)

- [ ] Campaign list loads
- [ ] Create campaign → campaign builder opens
- [ ] Launch campaign → status changes to Active
- [ ] Pause campaign → status changes to Paused
- [ ] Duplicate → copy appears in list
- [ ] Delete → removed from list
- [ ] Stats show (connections sent, accepted, messages, reply rate)

---

## 🤖 Inbound Automations (`/inbound`)

- [ ] Received Invitations panel — pending invitations load
- [ ] Accept — invitation accepted, removed from list, success toast
- [ ] Decline — invitation declined, removed from list
- [ ] Create automation — drawer opens, configure trigger + action
- [ ] Active automations listed with run count
- [ ] Template slots clickable

---

## ✍️ Content Assistant (`/content`)

- [ ] My Posts — loads your LinkedIn posts
- [ ] Company tab — enter company identifier → company posts load
- [ ] Create Post — type text → Publish → post appears at top
- [ ] Like — reaction added, success toast
- [ ] Comment — comment thread expands, type comment → Post → appears
- [ ] Error shown when no account connected

---

## 📊 Dashboard (`/dashboard`)

- [ ] Connections Sent — real count from `actions_log`
- [ ] Accepted — real count
- [ ] Messages — real count
- [ ] Replies — real count
- [ ] Profile Views — real count
- [ ] Activity Chart — shows real data per day (not mock)
- [ ] Time filter — 1d / 1w / 1m / 3m changes chart and stats
- [ ] Active Campaigns — real count
- [ ] Total Leads — real count from database
- [ ] Acceptance Rate — calculated correctly
- [ ] Pending Invites — real count from Unipile

---

## ⚙️ Settings (`/settings`)

- [ ] Workspace settings load
- [ ] Can update workspace name

---

## 🔧 Backend Worker

- [ ] Start backend: `npm run dev:backend` → logs "LinkedPilot Worker ready (Unipile mode)"
- [ ] Queue a connect action → worker calls Unipile `POST /users/invite`
- [ ] Queue a message action → worker calls Unipile chat + send message
- [ ] Queue a `view_profile` action → worker calls Unipile `GET /users/{id}`
- [ ] Queue a `scrapeLeads` action → worker calls Unipile search
- [ ] Failed actions logged to `actions_log` with error message
- [ ] Daily limits enforced (`AccountRestrictedError` on limit reached)
