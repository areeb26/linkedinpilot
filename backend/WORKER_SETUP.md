# LinkedPilot Queue Worker Setup Guide

The Queue Worker is a background service that processes pending LinkedIn actions (connection requests, messages, etc.) from the `action_queue` table.

## Overview

When users click "Connect" or schedule campaign actions, they are added to the `action_queue` with `status='pending'`. The worker continuously polls this queue and executes actions using the Unipile API.

## Features

- ✅ Continuous polling for pending actions
- ✅ Rate limiting (daily & weekly limits)
- ✅ Natural timing with random delays (30-90s between actions)
- ✅ Automatic retry on failures
- ✅ Cross-campaign rate limit enforcement
- ✅ Graceful shutdown handling
- ✅ Concurrent action processing (max 3 at a time)

## Prerequisites

1. **Python 3.8+** installed
2. **Unipile API credentials** (API key and DSN)
3. **Supabase credentials** (URL and service role key)
4. **LinkedIn account connected** via Unipile (login_method='hosted')

## Installation

### 1. Navigate to backend directory

```bash
cd backend
```

### 2. Create virtual environment (if not exists)

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create or update `.env` file in the `backend` directory:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Unipile
UNIPILE_API_KEY=your-unipile-api-key
UNIPILE_DSN=your-unipile-dsn

# Optional: Worker configuration
MAX_CONCURRENT_ACTIONS=3
MAX_RETRIES=2
```

## Running the Worker

### Option 1: Using the startup script (Recommended)

**Windows:**
```bash
start_worker.bat
```

**Mac/Linux:**
```bash
chmod +x start_worker.sh
./start_worker.sh
```

### Option 2: Direct Python execution

```bash
python worker.py
```

### Option 3: As a background service

**Windows (using NSSM):**
1. Download NSSM from https://nssm.cc/download
2. Install as service:
```bash
nssm install LinkedPilotWorker "C:\path\to\python.exe" "C:\path\to\backend\worker.py"
nssm start LinkedPilotWorker
```

**Linux (using systemd):**
Create `/etc/systemd/system/linkedpilot-worker.service`:
```ini
[Unit]
Description=LinkedPilot Queue Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/python worker.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable linkedpilot-worker
sudo systemctl start linkedpilot-worker
```

## Monitoring

### Check worker logs

The worker logs to console. Look for:

```
[INFO] Worker started. Polling for pending actions...
[INFO] Found 3 pending action(s)
[INFO] Processing action abc-123-def
[INFO] Action abc-123-def (connect) completed successfully.
```

### Check action queue status

Run this SQL in Supabase:

```sql
-- Pending actions
SELECT 
  id, action_type, status, scheduled_at, created_at
FROM action_queue
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Recently completed actions
SELECT 
  id, action_type, status, executed_at
FROM action_queue
WHERE status IN ('done', 'failed')
ORDER BY executed_at DESC
LIMIT 20;

-- Actions log (audit trail)
SELECT 
  action_type, status, executed_at
FROM actions_log
ORDER BY executed_at DESC
LIMIT 20;
```

### Check rate limits

```sql
-- Daily action counts
SELECT 
  linkedin_account_id,
  date,
  connection_requests,
  messages_sent,
  profile_views
FROM daily_action_counts
WHERE date = CURRENT_DATE;

-- Weekly action counts
SELECT 
  linkedin_account_id,
  week_start_date,
  connection_requests,
  messages_sent
FROM weekly_action_counts
WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days';
```

## Troubleshooting

### Worker not processing actions

1. **Check if worker is running:**
   - Look for "Worker started" in logs
   - Check process list: `ps aux | grep worker.py` (Linux) or Task Manager (Windows)

2. **Check LinkedIn account status:**
   ```sql
   SELECT id, full_name, status, login_method, unipile_account_id
   FROM linkedin_accounts;
   ```
   - Status should be 'active'
   - login_method should be 'hosted'
   - unipile_account_id should not be null

3. **Check Unipile credentials:**
   - Verify UNIPILE_API_KEY and UNIPILE_DSN in .env
   - Test API connection: `curl -H "Authorization: Bearer YOUR_API_KEY" https://api.unipile.com/api/v1/accounts`

4. **Check rate limits:**
   - Actions may be delayed if daily/weekly limits are reached
   - Check `daily_action_counts` and `weekly_action_counts` tables

### Actions failing

1. **Check error messages:**
   ```sql
   SELECT id, action_type, error_message, retry_count
   FROM action_queue
   WHERE status = 'failed'
   ORDER BY created_at DESC;
   ```

2. **Common errors:**
   - `"Account restricted"` → LinkedIn account has hit rate limits
   - `"Session expired"` → Unipile account needs re-authentication
   - `"Profile not found"` → Invalid LinkedIn profile URL
   - `"No unipile_account_id"` → LinkedIn account not properly connected

### Rate limits exceeded

If you see "Rate limit exceeded" errors:

1. **Check current usage:**
   ```sql
   SELECT * FROM daily_action_counts WHERE date = CURRENT_DATE;
   SELECT * FROM weekly_action_counts WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days';
   ```

2. **Adjust limits in campaign settings:**
   - Daily limit: 5-20 connections/day (conservative)
   - Weekly limit: 100-200 connections/week (LinkedIn's limit)

3. **Wait for reset:**
   - Daily limits reset at midnight UTC
   - Weekly limits reset on Monday 00:00 UTC

## Configuration

### Worker settings

Edit `worker.py` to adjust:

```python
POLL_INTERVAL = 10  # seconds between polls (default: 10)
MAX_CONCURRENT = 3  # max concurrent actions (default: 3)
BATCH_SIZE = 10     # max actions per poll (default: 10)
```

### Rate limit settings

Edit campaign settings or LinkedIn account limits:

```sql
-- Update campaign daily limit
UPDATE campaigns
SET daily_limit = 10
WHERE id = 'your-campaign-id';

-- Update account limits
UPDATE linkedin_accounts
SET 
  daily_connection_limit = 10,
  daily_message_limit = 20
WHERE id = 'your-account-id';
```

## Best Practices

1. **Start with conservative limits:**
   - 5-10 connections/day for new accounts
   - 10-20 connections/day for warmed accounts
   - Never exceed 200 connections/week (LinkedIn's hard limit)

2. **Monitor account health:**
   - Check for "Account restricted" errors
   - Watch for unusual patterns in actions_log
   - Keep accounts active with regular manual activity

3. **Use natural timing:**
   - Worker adds 30-90s random delay between actions
   - Don't disable this - it protects your account

4. **Run worker continuously:**
   - Use systemd (Linux) or NSSM (Windows) for production
   - Worker handles reconnection and errors gracefully

5. **Test with small batches:**
   - Start with 1-2 test connections
   - Verify they appear in LinkedIn before scaling up

## Support

If you encounter issues:

1. Check worker logs for error messages
2. Run the diagnostic SQL queries above
3. Verify Unipile account is active and authenticated
4. Check LinkedIn account hasn't been restricted

## Architecture

```
┌─────────────────┐
│   Frontend UI   │
│  (React App)    │
└────────┬────────┘
         │ Queue action
         ▼
┌─────────────────┐
│  action_queue   │ ◄─── Worker polls every 10s
│   (Database)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Queue Worker   │
│   (worker.py)   │
└────────┬────────┘
         │ Execute via API
         ▼
┌─────────────────┐
│  Unipile API    │
│   (LinkedIn)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  actions_log    │ ◄─── Audit trail
│   (Database)    │
└─────────────────┘
```

## Next Steps

After starting the worker:

1. ✅ Verify worker is running (check logs)
2. ✅ Test with a single connection request
3. ✅ Check action appears in actions_log
4. ✅ Verify connection request appears in LinkedIn
5. ✅ Monitor rate limits and adjust as needed
6. ✅ Scale up to full campaign volume

Happy automating! 🚀
