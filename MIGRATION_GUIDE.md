# Migration Guide: Account Type & Weekly Limits

## Problem
The `supabase db push` command is failing because some policies already exist in the database from previous migrations.

## Solution
Apply only the new migration using one of the methods below.

---

## Method 1: Supabase SQL Editor (Recommended) ✅

This is the easiest and safest method.

### Steps:
1. **Open Supabase SQL Editor**
   - Go to your Supabase dashboard
   - Navigate to: SQL Editor → New Query

2. **Copy Migration SQL**
   - Open file: `scripts/apply_account_type_migration.sql`
   - Copy all contents (Ctrl+A, Ctrl+C)

3. **Paste and Run**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for success message

4. **Verify**
   - Check for "Migration completed successfully!" message
   - No errors should appear

---

## Method 2: Using PowerShell Script (Windows)

### Steps:
```powershell
# Run the migration script
.\scripts\apply_account_type_migration.ps1
```

The script will:
- Load your Supabase credentials from `.env`
- Offer to apply migration via `psql` (if installed)
- Or show instructions for manual application

---

## Method 3: Using Bash Script (Linux/Mac)

### Steps:
```bash
# Make script executable
chmod +x scripts/apply_account_type_migration.sh

# Run the migration script
./scripts/apply_account_type_migration.sh
```

---

## Method 4: Direct psql Command

If you have `psql` installed and know your database password:

```bash
# Set your password
export PGPASSWORD='your_database_password'

# Apply migration
psql -h db.YOUR_PROJECT_REF.supabase.co \
     -p 5432 \
     -U postgres \
     -d postgres \
     -f scripts/apply_account_type_migration.sql
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

---

## What This Migration Does

### Database Changes:
1. ✅ Adds `account_type` column (free/premium/sales_navigator/recruiter)
2. ✅ Adds `weekly_connection_limit` column (default: 105)
3. ✅ Adds `weekly_message_limit` column (default: 300)
4. ✅ Adds `this_week_connections` counter
5. ✅ Adds `this_week_messages` counter
6. ✅ Adds `week_reset_at` timestamp
7. ✅ Creates `reset_weekly_counters()` function
8. ✅ Creates `check_weekly_limit()` function
9. ✅ Updates `increment_action_count()` function
10. ✅ Creates indexes for performance

### Default Values:
- **Free accounts**: 15/day, 105/week connections
- **Premium accounts**: 80/day, 200/week connections

---

## Verification

After applying the migration, verify it worked:

### Check Columns Exist:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'linkedin_accounts'
  AND column_name IN (
    'account_type',
    'weekly_connection_limit',
    'weekly_message_limit',
    'this_week_connections',
    'this_week_messages',
    'week_reset_at'
  );
```

Expected output: 6 rows showing the new columns.

### Check Functions Exist:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN (
  'reset_weekly_counters',
  'check_weekly_limit',
  'increment_action_count'
);
```

Expected output: 3 rows showing the functions.

### Check Account Types:
```sql
SELECT 
  full_name,
  account_type,
  daily_connection_limit,
  weekly_connection_limit
FROM linkedin_accounts;
```

Expected output: All accounts should have `account_type` set.

---

## After Migration

### 1. Restart Worker
```bash
# Stop current worker (Ctrl+C)

# Start worker again
python backend/worker.py
```

### 2. Deploy Frontend
```bash
# Build frontend
npm run build

# Deploy dist folder to your hosting
```

### 3. Test in UI
1. Open LinkedIn Accounts page
2. Click "Settings" on any account
3. Verify account type selector works
4. Try changing limits
5. Verify warnings appear
6. Save and check table shows weekly usage

---

## Troubleshooting

### Error: "relation already exists"
**Solution**: This is normal. The migration uses `IF NOT EXISTS` to skip existing tables.

### Error: "function already exists"
**Solution**: The migration uses `CREATE OR REPLACE` to update existing functions.

### Error: "permission denied"
**Solution**: Make sure you're using the service role key, not the anon key.

### Error: "column already exists"
**Solution**: The migration uses `ADD COLUMN IF NOT EXISTS` to skip existing columns.

### Migration seems stuck
**Solution**: 
1. Check Supabase dashboard for active queries
2. Cancel any long-running queries
3. Try again

### Still having issues?
1. Check Supabase logs in dashboard
2. Verify `.env` file has correct credentials
3. Try Method 1 (SQL Editor) - it's the most reliable

---

## Rollback (If Needed)

If you need to undo the migration:

```sql
-- Remove new columns
ALTER TABLE linkedin_accounts
  DROP COLUMN IF EXISTS account_type,
  DROP COLUMN IF EXISTS weekly_connection_limit,
  DROP COLUMN IF EXISTS weekly_message_limit,
  DROP COLUMN IF EXISTS this_week_connections,
  DROP COLUMN IF EXISTS this_week_messages,
  DROP COLUMN IF EXISTS week_reset_at;

-- Drop new functions
DROP FUNCTION IF EXISTS reset_weekly_counters();
DROP FUNCTION IF EXISTS check_weekly_limit(UUID, TEXT);

-- Note: increment_action_count will revert to previous version
-- You may need to restore it from a backup
```

---

## Success Indicators

✅ Migration runs without errors  
✅ New columns appear in `linkedin_accounts` table  
✅ Functions are created/updated  
✅ Existing data is preserved  
✅ Frontend builds successfully  
✅ Settings modal opens and works  
✅ Weekly usage shows in accounts table  

---

## Support

If you encounter any issues:
1. Check the error message carefully
2. Verify your Supabase credentials
3. Try the SQL Editor method (most reliable)
4. Check Supabase dashboard logs
5. Refer to `docs/account-type-limits-implementation.md` for details

---

**Last Updated**: April 28, 2026  
**Migration File**: `scripts/apply_account_type_migration.sql`  
**Status**: Ready to apply
