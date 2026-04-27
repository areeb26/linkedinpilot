# Quick Start: Process Your Pending Connection Requests

Your connection requests are queued but not being processed. Follow these steps to start the worker and send them.

## Step 1: Check Your Environment

Make sure you have a `.env` file in the `backend` directory with:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
UNIPILE_API_KEY=your-unipile-api-key
UNIPILE_DSN=your-unipile-dsn
```

## Step 2: Start the Worker

**Windows:**
```bash
cd backend
start_worker.bat
```

**Mac/Linux:**
```bash
cd backend
chmod +x start_worker.sh
./start_worker.sh
```

## Step 3: Watch the Logs

You should see:

```
==========================================
LinkedPilot Queue Worker
==========================================
[INFO] Worker started. Polling for pending actions...
[INFO] Found 10 pending action(s)
[INFO] Processing action abc-123-def
[INFO] Waiting 45s before executing connect...
[INFO] Action abc-123-def (connect) completed successfully.
```

## Step 4: Verify in LinkedIn

1. Go to LinkedIn → My Network → Manage invitations
2. You should see your sent connection requests appearing
3. Check the campaign analytics - "Connections Sent" should update

## What's Happening?

1. **Worker polls** the `action_queue` table every 10 seconds
2. **Finds pending actions** (your 10 connection requests)
3. **Checks rate limits** (daily: 5-20, weekly: 200)
4. **Adds natural delay** (30-90 seconds between actions)
5. **Sends via Unipile API** to LinkedIn
6. **Logs to actions_log** (audit trail)
7. **Updates analytics** (campaign stats)

## Troubleshooting

### Worker says "No pending actions found"

Check the queue:
```sql
SELECT id, action_type, status, scheduled_at
FROM action_queue
WHERE status = 'pending';
```

### Actions failing with errors

Check error messages:
```sql
SELECT id, action_type, error_message
FROM action_queue
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Rate limit exceeded

Check your usage:
```sql
SELECT * FROM daily_action_counts WHERE date = CURRENT_DATE;
```

If you've hit the limit, actions will be rescheduled for tomorrow.

## Expected Timeline

With 10 pending connections and natural delays:

- **First connection:** Immediate (after 30-90s delay)
- **Subsequent connections:** 30-90s apart
- **Total time:** ~5-15 minutes for all 10

The worker respects rate limits, so if you've already sent connections today, some may be delayed until tomorrow.

## Stop the Worker

Press `Ctrl+C` in the terminal to stop gracefully.

## Check Status Anytime

Run this to see what's happening:

```bash
python check_status.py
```

This shows:
- ✅ Pending/completed/failed action counts
- ✅ Rate limit usage (daily & weekly)
- ✅ Recent errors
- ✅ Campaign analytics

## Need Help?

See `WORKER_SETUP.md` for detailed documentation.
