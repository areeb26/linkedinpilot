# Campaign End Date Auto-Pause Implementation

## Overview
Campaigns with an end date will now automatically pause when the end date passes. The UI displays a "Date Passed" badge to clearly indicate this status.

## Implementation Details

### Backend Changes

#### 1. Worker Auto-Pause Logic (`backend/worker.py`)
- **Location**: `sync_connections()` function, lines ~300-350
- **Frequency**: Runs every 60 seconds during the sync cycle
- **Logic**:
  1. Fetches all active campaigns with their `settings` and `timezone`
  2. Extracts `settings.schedule.endDate` (format: `YYYY-MM-DD`)
  3. Compares current date (in campaign's timezone) with end date
  4. If `current_date > end_date`, updates campaign status to `paused`
  5. Logs: `Campaign 'Campaign Name' auto-paused (end date YYYY-MM-DD passed)`
  6. Skips completion check for paused campaigns

#### 2. Dependencies (`backend/requirements.txt`)
- Added `pytz` for timezone-aware date comparisons

### Frontend Changes

#### 1. Campaign Hook (`src/hooks/useCampaigns.js`)
- Added `isEndDatePassed` flag to each campaign
- Checks if `settings.schedule.endDate` has passed
- Returns flag with campaign data for UI consumption

#### 2. Campaigns List Page (`src/pages/Campaigns.jsx`)
- Added new status style: `date-passed` (red/destructive theme)
- Logic: If `status === 'paused' && isEndDatePassed`, show "Date Passed" badge
- Badge styling: Red dot, red text, red background with border

#### 3. Campaign Detail Page (`src/pages/CampaignDetail.jsx`)
- Updated `getStatusBadge()` to accept `isEndDatePassed` parameter
- Shows "Date Passed" badge when campaign is paused due to end date
- Consistent styling with campaigns list page

## User Experience

### What Users See

1. **Before End Date**:
   - Campaign shows "Active" badge (green)
   - Actions continue to execute normally

2. **After End Date Passes**:
   - Worker auto-pauses campaign within 60 seconds
   - Badge changes to "Date Passed" (red)
   - No new actions are scheduled or executed
   - Campaign can be resumed by editing and extending the end date

3. **Resume Options**:
   - Click "Edit Campaign" button
   - Update the end date to a future date
   - Change status back to "Active"
   - Campaign resumes normal operation

### Badge Colors

| Status | Badge Text | Color | Meaning |
|--------|-----------|-------|---------|
| Active | Active | Green | Campaign is running |
| Paused | Paused | Yellow/Orange | Manually paused by user |
| **Date Passed** | **Date Passed** | **Red** | **Auto-paused due to end date** |
| Draft | Draft | Gray | Not yet launched |
| Completed | Completed | Gray | All leads processed |

## Technical Details

### End Date Storage
- Stored in: `campaigns.settings` (JSONB field)
- Path: `settings.schedule.endDate`
- Format: `YYYY-MM-DD` (ISO date string)
- Example: `"2026-05-15"`

### Timezone Handling
- Uses campaign's `timezone` field (default: `UTC`)
- Compares dates in campaign's timezone to avoid timezone issues
- Example: Campaign in `America/New_York` timezone will pause at midnight EST/EDT

### Worker Behavior
- Checks end dates every 60 seconds (during sync cycle)
- Only checks campaigns with `status = 'active'`
- Paused campaigns are skipped (no re-checking)
- Logs all auto-pause actions for monitoring

### Edge Cases Handled
✅ Campaign with no end date (null) - ignored, runs indefinitely  
✅ Invalid end date format - logged as warning, campaign continues  
✅ Timezone conversion errors - logged as warning, campaign continues  
✅ Multiple campaigns ending simultaneously - all processed in same cycle  
✅ Campaign manually resumed after auto-pause - works normally  

## Testing

### Manual Testing Steps

1. **Create Test Campaign**:
   - Create a new campaign
   - Set end date to tomorrow
   - Launch the campaign

2. **Wait for End Date**:
   - Wait until the end date passes
   - Within 60 seconds, campaign should auto-pause

3. **Verify UI**:
   - Check campaigns list shows "Date Passed" badge (red)
   - Check campaign detail page shows "Date Passed" badge
   - Verify no new actions are being scheduled

4. **Resume Campaign**:
   - Click "Edit Campaign"
   - Update end date to future date
   - Change status to "Active"
   - Verify campaign resumes

### Worker Logs to Monitor

```bash
# Successful auto-pause
Campaign 'Test Campaign' auto-paused (end date 2026-04-28 passed)

# End date parsing error
Failed to parse end date for campaign abc-123: Invalid date format

# Database update error
Failed to pause campaign abc-123 (end date passed): Connection error
```

## Future Enhancements

Possible improvements for future versions:

1. **Email Notifications**: Notify users when campaign auto-pauses
2. **Warning Period**: Show warning 24 hours before end date
3. **Auto-Archive**: Option to auto-archive instead of pause
4. **Extend Button**: Quick "Extend by 7 days" button in UI
5. **Analytics**: Track how many campaigns auto-pause vs complete naturally

## Files Modified

### Backend
- `backend/worker.py` - Added end date checking logic
- `backend/requirements.txt` - Added pytz dependency

### Frontend
- `src/hooks/useCampaigns.js` - Added isEndDatePassed flag
- `src/pages/Campaigns.jsx` - Added "Date Passed" badge styling
- `src/pages/CampaignDetail.jsx` - Added "Date Passed" badge display

## Deployment Notes

### Backend Deployment
1. Install new dependency: `pip install pytz`
2. Restart worker service
3. Monitor logs for auto-pause messages

### Frontend Deployment
1. Build: `npm run build`
2. Deploy dist folder
3. Clear browser cache to see new badge styles

## Support

If campaigns are not auto-pausing:
1. Check worker is running: `ps aux | grep worker.py`
2. Check worker logs for errors
3. Verify campaign has `settings.schedule.endDate` set
4. Verify end date format is `YYYY-MM-DD`
5. Check campaign timezone is valid

---

**Implementation Date**: April 28, 2026  
**Version**: 1.0  
**Status**: ✅ Complete and Tested
