# Unipile API Integration — LinkedPilot

## Overview

LinkedPilot uses [Unipile](https://unipile.com) as its LinkedIn API layer. Unipile handles LinkedIn session management, proxies, rate limiting, and all LinkedIn actions on behalf of connected accounts.

**Why Unipile?**
- LinkedIn has no official public API for outreach automation
- Unipile manages LinkedIn sessions, cookies, and proxies so we don't have to
- Handles 2FA, checkpoints, and reconnection flows
- Provides a unified REST API for messaging, profiles, invitations, search, and posts

---

## Configuration

### Environment Variables

```env
# Frontend (Vite)
VITE_UNIPILE_DSN=api41.unipile.com:17150     # Your Unipile tenant DSN
VITE_UNIPILE_API_KEY=your_api_key_here       # Your Unipile API key

# Backend (FastAPI worker)
UNIPILE_DSN=api41.unipile.com:17150
UNIPILE_API_KEY=your_api_key_here
```

Get these from: [dashboard.unipile.com](https://dashboard.unipile.com) → Settings → API Keys

### Base URL

All API calls go to:
```
https://{UNIPILE_DSN}/api/v1/{endpoint}
```

### Authentication

Every request includes:
```
X-API-KEY: {UNIPILE_API_KEY}
```

---

## Frontend Client

**File:** `src/lib/unipile.js`

Browser-safe fetch wrapper. Does NOT use the `unipile-node-sdk` (which requires Node.js `crypto` module). All calls use native `fetch`.

```js
import { unipile } from '@/lib/unipile'

// Example
const accounts = await unipile.account.getAll()
const chats = await unipile.messaging.getAllChats({ account_id: 'abc123' })
```

---

## Backend Client

**File:** `backend/utils/unipile.py`

Async Python client using `httpx`. Used by the FastAPI action queue worker.

```python
from utils.unipile import UnipileClient

client = UnipileClient()
result = await client.send_invitation(account_id, provider_id, message)
```

---

## API Reference

### 1. Account Management

#### Connect Account — Hosted Auth (recommended)
**Where used:** `ConnectAccountModal.jsx` → Hosted Auth tab  
**Hook:** `useConnectHostedAuth()` in `src/hooks/useUnipileAccounts.js`

```
POST /api/v1/hosted/accounts/link
```

**Why:** Unipile shows its own LinkedIn login UI. No credentials stored in LinkedPilot.

**Payload:**
```json
{
  "type": "create",
  "providers": ["LINKEDIN"],
  "expiresOn": "2026-04-25T10:00:00.000Z",
  "name": "{workspaceId}:{userId}"
}
```

**On production only** (not localhost):
```json
{
  "api_url": "https://api41.unipile.com:17150",
  "notify_url": "https://your-supabase.co/functions/v1/unipile-webhook",
  "success_redirect_url": "https://yourapp.com/linkedin-accounts?unipile_connected=1",
  "failure_redirect_url": "https://yourapp.com/linkedin-accounts?unipile_error=1"
}
```

> ⚠️ **Important:** Do NOT include `api_url` on localhost — Unipile embeds it in the hosted auth URL, causing it to open `localhost` instead of `account.unipile.com`.

**Response:**
```json
{ "object": "HostedAuthUrl", "url": "https://account.unipile.com/TOKEN" }
```

**Flow:**
1. Call API → get hosted auth URL
2. Open URL in new tab → user logs in on Unipile's page
3. Unipile calls `notify_url` webhook → saves `unipile_account_id` to Supabase
4. Poll Supabase every 3s → detect new account → close modal

---

#### Connect Account — Credentials
**Where used:** `ConnectAccountModal.jsx` → Credentials tab  
**Hook:** `useConnectCredentials()`

```
POST /api/v1/accounts
```

**Payload:**
```json
{
  "provider": "LINKEDIN",
  "username": "user@email.com",
  "password": "password123"
}
```

**Response (success):**
```json
{ "object": "AccountCreated", "account_id": "abc123" }
```

**Response (2FA required):**
```json
{
  "object": "Checkpoint",
  "account_id": "abc123",
  "checkpoint": { "type": "2FA" }
}
```

**Checkpoint types:** `2FA`, `OTP`, `IN_APP_VALIDATION`, `CAPTCHA`, `PHONE_REGISTER`

---

#### Connect Account — Cookie (li_at)
**Where used:** `ConnectAccountModal.jsx` → Cookies tab  
**Hook:** `useConnectCookie()`

```
POST /api/v1/accounts
```

**Payload:**
```json
{
  "provider": "LINKEDIN",
  "access_token": "AQEDATxxxxxx"
}
```

---

#### Solve 2FA Checkpoint
**Where used:** `ConnectAccountModal.jsx` → `CheckpointOverlay` component  
**Hook:** `useSolveCheckpoint()`

```
POST /api/v1/accounts/checkpoint
```

**Payload:**
```json
{
  "account_id": "abc123",
  "provider": "LINKEDIN",
  "code": "123456"
}
```

---

#### Resend OTP
**Hook:** `useResendCheckpoint()`

```
POST /api/v1/accounts/checkpoint/resend
```

**Payload:**
```json
{ "account_id": "abc123", "provider": "LINKEDIN" }
```

---

#### List Accounts
**Where used:** `LinkedInAccounts.jsx` — merged with Supabase rows  
**Hook:** `useUnipileAccounts(workspaceId)`

```
GET /api/v1/accounts
```

**Response:**
```json
{
  "items": [
    {
      "id": "abc123",
      "sources": [{ "status": "OK" }]
    }
  ]
}
```

**Status values:** `OK` → Connected, `CREDENTIALS` / `STOPPED` → Reconnect Required, `ERROR` / `PERMISSIONS` → Error, `CONNECTING` → Connecting

---

#### Resync Account
**Where used:** `LinkedInAccounts.jsx` → Reconnect button  
**Hook:** `useReconnectAccount()`

```
GET /api/v1/accounts/{id}/sync
```

---

#### Delete Account
**Where used:** `LinkedInAccounts.jsx` → Remove button  
**Hook:** `useDeleteUnipileAccount()`

```
DELETE /api/v1/accounts/{id}
```

> Deletes from Unipile first, then removes the Supabase row. If Unipile delete fails, Supabase row is kept.

---

### 2. Messaging

#### List Chats
**Where used:** `Inbox.jsx` — left panel chat list  
**Hook:** `useChats(accountId)`

```
GET /api/v1/chats?account_id={id}&account_type=LINKEDIN&limit=50
```

**Chat object fields:**
- `id` — chat ID
- `attendees[0].name` — contact name
- `attendees[0].profile_picture_url` — avatar
- `last_message.text` — preview
- `unread_count` — unread indicator

---

#### List Messages
**Where used:** `Inbox.jsx` — message thread  
**Hook:** `useMessages(chatId)`

```
GET /api/v1/chats/{id}/messages
```

**Message object fields:**
- `id` — message ID
- `text` — message content
- `is_sender` — boolean: `true` if sent by you (outbound), `false` if received (inbound)
- `timestamp` — message date/time
- `seen` — read status (0 or 1)
- `attachments` — array of file attachments
- `reactions` — emoji reactions
- `is_event` — boolean: whether this is an event (reaction, etc.)
- `event_type` — type of event if `is_event` is true

**Note:** The API uses `is_sender` field, not `direction`. Previous documentation was incorrect.

---

#### List Chat Attendees
**Where used:** `Inbox.jsx` — right panel contact info  
**Hook:** `useChatAttendees(chatId)`

```
GET /api/v1/chats/{id}/attendees
```

---

#### Send Message
**Where used:** `Inbox.jsx` — message input bar  
**Hook:** `useSendMessage()`  
**Backend:** `UnipileClient.send_message()` for campaign actions

```
POST /api/v1/chats/{id}/messages
```

**Body (FormData):**
```
text: "Hello!"
```

> Uses FormData (not JSON) per SDK spec.

**Optimistic update:** Message appears immediately in UI, reverts on failure.

---

#### Start New DM
**Where used:** `LeadDatabase.jsx` → Send Message button  
**Hook:** `useStartDM()`

```
POST /api/v1/chats
```

**Body (FormData):**
```
account_id: abc123
attendees_ids: ACoAAA...
text: Hello!
```

---

#### Send InMail
**Where used:** `Inbox.jsx` → InMail option  
**Hook:** `useSendInMail()`

```
POST /api/v1/chats
```

**Body (FormData):**
```
account_id: abc123
attendees_ids: ACoAAA...
text: Hello!
linkedin[api]: classic
linkedin[inmail]: true
```

---

#### Send File Attachment
**Where used:** `Inbox.jsx` → paperclip button  
**Hook:** `useSendAttachment()`

```
POST /api/v1/chats/{id}/messages
```

**Body (FormData):**
```
text: optional message
attachments: [file]
```

**Validation:** Max 10 MB. Checked before API call.

---

### 3. Profiles

#### Get User Profile
**Where used:** `LeadDatabase.jsx` → View Profile modal  
**Hook:** `useProfile(accountId, identifier)`  
**Backend:** `UnipileClient.get_profile()` for `view_profile` actions

```
GET /api/v1/users/{identifier}?account_id={id}
```

**identifier** = LinkedIn public URL slug (e.g. `satyanadella`) or provider ID (`ACoAAA...`)

**Response fields:** `first_name`, `last_name`, `headline`, `profile_picture_url`, `location`, `summary`, `public_identifier`, `provider_id`

> Returns `{ error: { code: 'PROFILE_NOT_FOUND' } }` on 404 instead of throwing.

---

#### Get Own Profile
**Where used:** `ContentAssistant.jsx` — to resolve `public_identifier` for post listing  
**Hook:** `useOwnProfile(accountId)`

```
GET /api/v1/users/me?account_id={id}
```

---

#### Get Company Profile
**Where used:** `ContentAssistant.jsx` → Company Posts view  
**Hook:** `useCompanyProfile(accountId, identifier)`

```
GET /api/v1/linkedin/company/{identifier}?account_id={id}
```

---

#### List Connections (Relations)
**Where used:** `Dashboard.jsx` — Connections stat card  
**Hook:** `useRelations(accountId)`

```
GET /api/v1/users/relations?account_id={id}
```

Paginates through all pages automatically. Returns `{ items: [...], total: number }`.

---

### 4. Invitations

#### Send Connection Request
**Where used:** `LeadDatabase.jsx` → Send Invite button  
**Hook:** `useSendInvitation()`  
**Backend:** `UnipileClient.send_invitation()` for `connect` actions

```
POST /api/v1/users/invite
```

**Body (JSON):**
```json
{
  "account_id": "abc123",
  "provider_id": "ACoAAA...",
  "message": "Hi, let's connect!"
}
```

> `provider_id` is the LinkedIn member URN — get it from `getProfile()` response.

On success: updates lead `connection_status` to `"invited"` in Supabase.

---

#### List Sent Invitations
**Where used:** `Dashboard.jsx` — Pending Invites stat card  
**Hook:** `useSentInvitations(accountId)`

```
GET /api/v1/users/invite/sent?account_id={id}
```

---

#### Cancel Sent Invitation
**Hook:** `useCancelInvitation()`

```
DELETE /api/v1/users/invite/sent/{invitation_id}?account_id={id}
```

---

#### List Received Invitations
**Where used:** `InboundAutomations.jsx` — Received Invitations panel  
**Hook:** `useReceivedInvitations(accountId)`

```
GET /api/v1/users/invite/received?account_id={id}
```

---

#### Accept / Decline Invitation
**Where used:** `InboundAutomations.jsx` → Accept / Decline buttons  
**Hook:** `useHandleInvitation()`

```
POST /api/v1/users/invite/received/{invitation_id}
```

**Body (JSON):**
```json
{
  "account_id": "abc123",
  "action": "accept",
  "linkedin_token": "TOKEN_FROM_INVITATION_OBJECT"
}
```

> `linkedin_token` is mandatory for LinkedIn — comes from the invitation object returned by `useReceivedInvitations`.

---

### 5. Search

#### Search LinkedIn
**Where used:** `LeadExtractor.jsx` → Search LinkedIn view  
**Hook:** `useSearch()` in `src/hooks/useUnipileSearch.js`  
**Backend:** `UnipileClient.search()` for `scrapeLeads` actions

```
POST /api/v1/linkedin/search?account_id={id}&limit=25
```

**Body (JSON):**
```json
{
  "api": "classic",
  "category": "people",
  "keywords": "software engineer"
}
```

**`api` values:** `classic`, `sales_navigator`, `recruiter`  
**`category` values:** `people`, `companies`, `posts`, `jobs`

**Response:**
```json
{
  "items": [...],
  "cursor": "eyJ...",
  "paging": { "total_count": 1000 }
}
```

**Pagination:** Pass `cursor` in body to load next page. `useSearch()` supports `loadMore()` without resetting results.

**Rate limits:**
- Classic: ~1,000 results per search query
- Sales Navigator / Recruiter: ~2,500 results per query
- Recommended: ≤1,000 profiles/day per account

---

#### Get Search Filter Parameters
**Where used:** `LeadExtractor.jsx` — filter dropdowns  
**Hook:** `useSearchParameters(accountId, paramType)`

```
GET /api/v1/linkedin/search/parameters?account_id={id}&type=INDUSTRY
```

**`type` values:** `INDUSTRY`, `LOCATION`, `SKILL`, `COMPANY`, `SCHOOL`

---

### 6. Posts & Engagement

#### List User Posts
**Where used:** `ContentAssistant.jsx` — My Posts view  
**Hook:** `useMyPosts(accountId)`

```
GET /api/v1/users/{public_identifier}/posts?account_id={id}
```

> First calls `getOwnProfile()` to resolve `public_identifier`, then lists posts.

---

#### List Company Posts
**Where used:** `ContentAssistant.jsx` → Company tab  
**Hook:** `useCompanyPosts(accountId, identifier)`

```
GET /api/v1/users/{identifier}/posts?account_id={id}
```

---

#### Create Post
**Where used:** `ContentAssistant.jsx` → Create Post form  
**Hook:** `useCreatePost()`

```
POST /api/v1/posts
```

**Body (FormData):**
```
text: Post content here
account_id: abc123
```

> Uses FormData (not JSON) per SDK spec.

---

#### Comment on Post
**Where used:** `ContentAssistant.jsx` → Comment button  
**Hook:** `useCommentOnPost()`

```
POST /api/v1/posts/{social_id}/comments
```

**Body (JSON):**
```json
{ "account_id": "abc123", "text": "Great post!" }
```

> Use `post.social_id` (e.g. `urn:li:activity:123...`), NOT `post.id`. Unipile requires `social_id` for comment/reaction operations.

---

#### React to Post
**Where used:** `ContentAssistant.jsx` → Like button  
**Hook:** `useReactToPost()`

```
POST /api/v1/posts/reaction
```

**Body (JSON):**
```json
{
  "account_id": "abc123",
  "post_id": "urn:li:activity:123...",
  "reaction_type": "LIKE"
}
```

**`reaction_type` values:** `LIKE`, `PRAISE`, `APPRECIATION`, `EMPATHY`, `INTEREST`, `ENTERTAINMENT`

> Use `post.social_id` as `post_id`.

---

#### List Post Comments
**Where used:** `ContentAssistant.jsx` → comment thread  
**Hook:** `usePostComments(accountId, postId)`

```
GET /api/v1/posts/{social_id}/comments?account_id={id}
```

---

## Backend Action Queue

The FastAPI worker (`backend/main.py`) processes actions from the Supabase `action_queue` table and calls Unipile instead of Playwright.

### Action Type → Unipile API Mapping

| `action_type` | Unipile call | Payload fields |
|---|---|---|
| `connect` | `POST /users/invite` | `provider_id`, `message?` |
| `message` | `GET+POST /chats` | `attendee_id`, `message` |
| `view_profile` | `GET /users/{identifier}` | `identifier` |
| `scrapeLeads` | `POST /linkedin/search` | `api_type`, `category`, `keywords`, `filters` |

### Payload Fallback

If `provider_id` / `attendee_id` is missing (legacy campaigns), the worker fetches `linkedin_member_id` from the `leads` table as a fallback.

### Error Mapping

| HTTP Status | Exception | Retry? |
|---|---|---|
| 401, 403 | `SessionExpiredError` | No (terminal) |
| 404 | `ProfileNotFoundError` | No (terminal) |
| 429 | `Exception` | Yes (back-off) |
| 5xx | `Exception` | Yes (back-off) |

---

## Webhook — `unipile-webhook`

**File:** `supabase/functions/unipile-webhook/index.ts`

Receives POST from Unipile after hosted auth completes.

**Deploy:**
```bash
npx supabase functions deploy unipile-webhook
```

**Payload from Unipile:**
```json
{
  "status": "CREATION_SUCCESS",
  "account_id": "abc123",
  "name": "{workspaceId}:{userId}"
}
```

**What it does:**
1. Parses `workspaceId` from `name`
2. Finds the most recent `linkedin_accounts` row without `unipile_account_id`
3. Updates it with the new `account_id`

---

## Rate Limits (LinkedIn via Unipile)

| Action | Limit |
|---|---|
| Connection requests (paid account) | 80–100/day, ~200/week |
| Connection requests (free account) | ~5/month with note, 150/week without |
| Profile views | ~100/day per account |
| Messages to connections | ~100/day per account |
| InMail (Career plan) | 5/month |
| Search results (Classic) | 1,000 per query |
| Search results (Sales Nav / Recruiter) | 2,500 per query |

> Space out actions randomly. Avoid fixed-interval scheduling (detectable as automation).

---

## Known Issues & Notes

### Hosted Auth on Localhost
`api_url` must NOT be included in the hosted auth payload when running on localhost. Unipile embeds `api_url` into the hosted auth token, causing the browser to open `localhost:PORT/token` instead of `account.unipile.com/token`.

**Fix:** `api_url` is only included on production (non-localhost) deployments.

### social_id vs id for Posts
Unipile uses two different IDs for posts:
- `id` — numeric ID (e.g. `7332661864792854528`)
- `social_id` — URN format (e.g. `urn:li:activity:7332661864792854528`)

Always use `social_id` for comment and reaction operations.

### FormData vs JSON
Some Unipile endpoints require FormData instead of JSON:
- `POST /api/v1/chats/{id}/messages` — FormData
- `POST /api/v1/chats` — FormData
- `POST /api/v1/posts` — FormData

All others use JSON.

### Supabase `unipile_account_id` Column
Run this migration before using Unipile features:
```sql
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_unipile_id
  ON linkedin_accounts (unipile_account_id);
```
