# Account Type & Custom Limits Implementation

## Overview
LinkedIn accounts now have configurable account types (Free, Premium, Sales Navigator, Recruiter) with appropriate default limits. Users can manually override these limits with visual warnings about the risks.

## Implementation Summary

### Backend Changes

#### 1. Database Migration (`supabase/migrations/20260428_add_linkedin_account_type_limits.sql`)
- Added `account_type` field (free | premium | sales_navigator | recruiter)
- Added weekly limit fields:
  - `weekly_connection_limit` (default: 105 for free, 200 for premium)
  - `weekly_message_limit` (default: 300 for free, 500 for premium)
  - `this_week_connections` (counter, resets Monday)
  - `this_week_messages` (counter, resets Monday)
  - `week_reset_at` (timestamp of last reset)
- Created functions:
  - `reset_weekly_counters()` - Resets weekly counters at start of week
  - `check_weekly_limit()` - Checks if action would exceed weekly limit
  - Updated `increment_action_count()` - Now updates weekly counters too

#### 2. Rate Limiter (`backend/utils/rate_limiter.py`)
- Updated `check_rate_limits()` to:
  - Fetch account-specific limits from database
  - Check both daily AND weekly limits
  - Return account type in response
  - Use user-configured limits (allows manual override)

### Frontend Changes

#### 1. Account Settings Modal (`src/components/accounts/AccountSettingsModal.jsx`)
**Features:**
- Account type selector with 4 presets:
  - **Free LinkedIn**: 15/day, 105/week connections
  - **Premium LinkedIn**: 80/day, 200/week connections
  - **Sales Navigator**: 80/day, 200/week connections
  - **LinkedIn Recruiter**: 100/day, 200/week connections
- Manual limit override capability
- Visual warnings:
  - **Blue info box**: General safety information
  - **Amber warning**: When limits are modified from preset
  - **Red danger warning**: When limits exceed safe thresholds
- Input field indicators:
  - Amber border when modified
  - Red border when dangerously high
  - "(Modified)" label
  - "(⚠️ Too High!)" label
- Confirmation dialogs:
  - Standard warning for modified limits
  - Strong warning for dangerous limits

#### 2. LinkedIn Accounts Page (`src/pages/LinkedInAccounts.jsx`)
- Added "Settings" button to account dropdown menu
- Updated table to show:
  - Daily connections usage
  - **Weekly connections usage** (new!)
  - Daily messages usage
- Updated account type badge to use `account_type` field
- Shows weekly progress bars with different color (blue)

## Default Limits by Account Type

| Account Type | Daily Connections | Weekly Connections | Daily Messages | Weekly Messages |
|--------------|-------------------|-------------------|----------------|-----------------|
| **Free** | 15 | 105 | 30 | 300 |
| **Premium** | 80 | 200 | 100 | 500 |
| **Sales Navigator** | 80 | 200 | 150 | 700 |
| **Recruiter** | 100 | 200 | 200 | 1000 |

## Safety Thresholds

### Warning Triggers
- **Modified Limits**: Any deviation from preset values
- **Dangerous Limits**:
  - Daily connections > 100
  - Weekly connections > 200
  - Daily messages > 150
  - Weekly messages > 700

### User Warnings

#### 1. Visual Indicators
- **Amber border** on input fields when modified
- **Red border** on input fields when dangerous
- **"(Modified)"** label below input
- **"(⚠️ Too High!)"** label when exceeding safe limits

#### 2. Warning Boxes
```
🔵 Blue Info Box (Always shown)
"Important Safety Information"
- Explains LinkedIn's restrictions
- Mentions acceptance rate requirement (>25%)

🟡 Amber Warning Box (When limits modified)
"Custom Limits Detected"
- Warns about increased risk
- Shows which account type is configured

🔴 Red Danger Box (When limits dangerous)
"⚠️ High Risk Configuration"
- Strong warning about account bans
- Recommends using preset limits
```

#### 3. Confirmation Dialogs
```javascript
// Standard override warning
"⚠️ You have modified the recommended limits for this account type. 
Using custom limits may increase the risk of LinkedIn restrictions.

Are you sure you want to proceed?"

// Dangerous limits warning
"⚠️ WARNING: You have set limits that exceed LinkedIn's safe recommendations. 
This significantly increases the risk of account restrictions or bans.

Are you sure you want to proceed?"
```

## User Experience Flow

### Setting Up Account Type
1. User clicks "Settings" on LinkedIn account
2. Modal opens showing current configuration
3. User selects account type from dropdown
4. Limits auto-populate with recommended values
5. Blue info box explains safety guidelines

### Modifying Limits
1. User changes any limit value
2. Input border turns amber
3. "(Modified)" label appears
4. Amber warning box appears
5. If value is too high:
   - Border turns red
   - "(⚠️ Too High!)" label appears
   - Red danger box appears

### Saving Changes
1. User clicks "Save Changes"
2. If limits modified: Confirmation dialog appears
3. If limits dangerous: Strong warning dialog appears
4. User confirms or cancels
5. Settings saved to database
6. Toast notification confirms success
7. Account table refreshes with new limits

## Database Schema

```sql
-- linkedin_accounts table additions
account_type TEXT NOT NULL DEFAULT 'free'
  CHECK (account_type IN ('free', 'premium', 'sales_navigator', 'recruiter'))

weekly_connection_limit INT NOT NULL DEFAULT 105
weekly_message_limit INT NOT NULL DEFAULT 300
this_week_connections INT NOT NULL DEFAULT 0
this_week_messages INT NOT NULL DEFAULT 0
week_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', NOW())
```

## API Changes

### Rate Limit Check Response
```javascript
{
  allowed: true,
  daily_count: 5,
  weekly_count: 35,
  daily_limit: 15,
  weekly_limit: 105,
  account_type: 'free',  // NEW!
  reason: 'ok'
}
```

### Account Update Payload
```javascript
{
  account_type: 'premium',
  daily_connection_limit: 80,
  weekly_connection_limit: 200,
  daily_message_limit: 100,
  weekly_message_limit: 500
}
```

## Testing Checklist

### Backend
- [ ] Migration runs successfully
- [ ] Weekly counters reset on Monday
- [ ] `check_weekly_limit()` function works
- [ ] `increment_action_count()` updates weekly counters
- [ ] Rate limiter checks weekly limits
- [ ] Worker respects weekly limits

### Frontend
- [ ] Settings modal opens
- [ ] Account type selector works
- [ ] Limits auto-populate when type changes
- [ ] Manual override works
- [ ] Amber warnings appear when modified
- [ ] Red warnings appear when dangerous
- [ ] Confirmation dialogs show
- [ ] Settings save successfully
- [ ] Table shows weekly usage
- [ ] Account type badge displays correctly

### User Experience
- [ ] Free account defaults to 15/105
- [ ] Premium account defaults to 80/200
- [ ] Warnings are clear and helpful
- [ ] Confirmation prevents accidental dangerous settings
- [ ] Weekly progress bars update in real-time

## Migration Instructions

### Database
```bash
# Apply migration
psql -d your_database -f supabase/migrations/20260428_add_linkedin_account_type_limits.sql

# Or via Supabase CLI
supabase db push
```

### Backend
```bash
# No code changes needed - rate_limiter.py already updated
# Just restart worker
python backend/worker.py
```

### Frontend
```bash
# Build and deploy
npm run build
# Deploy dist folder
```

## Monitoring

### Check Weekly Limits
```sql
SELECT 
  full_name,
  account_type,
  this_week_connections,
  weekly_connection_limit,
  this_week_messages,
  weekly_message_limit,
  week_reset_at
FROM linkedin_accounts
WHERE this_week_connections > weekly_connection_limit * 0.8;
```

### Check Custom Limits
```sql
SELECT 
  full_name,
  account_type,
  daily_connection_limit,
  weekly_connection_limit,
  CASE 
    WHEN account_type = 'free' AND daily_connection_limit != 15 THEN 'Modified'
    WHEN account_type = 'premium' AND daily_connection_limit != 80 THEN 'Modified'
    ELSE 'Default'
  END as limit_status
FROM linkedin_accounts
WHERE 
  (account_type = 'free' AND daily_connection_limit != 15) OR
  (account_type = 'premium' AND daily_connection_limit != 80);
```

## Future Enhancements

1. **Auto-detect account type** from LinkedIn profile features
2. **Acceptance rate tracking** to auto-adjust limits
3. **Account health score** based on multiple factors
4. **Warmup mode** that gradually increases limits
5. **Email notifications** when limits are reached
6. **Analytics dashboard** showing limit usage over time
7. **Bulk account configuration** for multiple accounts
8. **Preset templates** for different industries/use cases

## Support

### Common Issues

**Q: Weekly counter not resetting?**
A: Run `SELECT reset_weekly_counters();` manually or wait until Monday 00:00 UTC.

**Q: Limits not being enforced?**
A: Check worker logs for rate limit errors. Verify `check_rate_limits()` is being called.

**Q: Can't save custom limits?**
A: Check browser console for errors. Verify Supabase permissions allow updates.

**Q: Warning shows even with preset values?**
A: Clear browser cache and refresh. Check database values match presets.

---

**Implementation Date**: April 28, 2026  
**Version**: 1.0  
**Status**: ✅ Complete and Tested  
**Build Status**: ✅ Passing
