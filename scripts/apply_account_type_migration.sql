-- ============================================================
-- Add LinkedIn Account Type and Weekly Limits
-- Standalone script to apply only the new migration
-- ============================================================

-- 1. Add account_type and weekly limits to linkedin_accounts table
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS weekly_connection_limit INT NOT NULL DEFAULT 105,
  ADD COLUMN IF NOT EXISTS weekly_message_limit INT NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS this_week_connections INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS this_week_messages INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', NOW());

-- 2. Add check constraint for account_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'linkedin_accounts_account_type_check'
  ) THEN
    ALTER TABLE linkedin_accounts
      ADD CONSTRAINT linkedin_accounts_account_type_check 
      CHECK (account_type IN ('free', 'premium', 'sales_navigator', 'recruiter'));
  END IF;
END $$;

-- 3. Update existing accounts to have appropriate limits based on account_type
-- Free accounts: 15/day, 105/week
UPDATE linkedin_accounts 
SET 
  account_type = 'free',
  daily_connection_limit = 15,
  weekly_connection_limit = 105,
  daily_message_limit = 30,
  weekly_message_limit = 300
WHERE account_type = 'free' OR daily_connection_limit <= 15;

-- Premium accounts: 80/day, 200/week (for accounts that had higher limits)
UPDATE linkedin_accounts 
SET 
  account_type = 'premium',
  daily_connection_limit = 80,
  weekly_connection_limit = 200,
  daily_message_limit = 100,
  weekly_message_limit = 500
WHERE daily_connection_limit > 15;

-- 4. Handle reset_weekly_counters
-- The existing reset_weekly_counters() is a TRIGGER function on campaign_enrollments
-- with RETURNS TRIGGER. We can't CREATE OR REPLACE it with RETURNS void.
-- Strategy: DROP CASCADE (removes the trigger too), recreate the original trigger
-- function exactly as it was, then create a NEW separate function for linkedin_accounts.

DROP FUNCTION IF EXISTS reset_weekly_counters() CASCADE;

-- 4a. Recreate the original trigger function exactly as it was
CREATE FUNCTION reset_weekly_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.week_start_date < get_week_start_date(CURRENT_DATE) THEN
    NEW.actions_this_week := 0;
    NEW.week_start_date := get_week_start_date(CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger that was dropped by CASCADE
DROP TRIGGER IF EXISTS trg_reset_weekly_counters ON campaign_enrollments;
CREATE TRIGGER trg_reset_weekly_counters
  BEFORE UPDATE ON campaign_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION reset_weekly_counters();

-- 4b. New function to reset weekly counters on linkedin_accounts (separate from above)
CREATE OR REPLACE FUNCTION reset_linkedin_weekly_counters()
RETURNS void AS $$
BEGIN
  UPDATE linkedin_accounts
  SET 
    this_week_connections = 0,
    this_week_messages = 0,
    week_reset_at = date_trunc('week', NOW())
  WHERE week_reset_at < date_trunc('week', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_linkedin_weekly_counters IS 'Resets weekly action counters on linkedin_accounts at the start of each week (Monday)';

-- 5. Create function to check if weekly limit would be exceeded
DROP FUNCTION IF EXISTS check_weekly_limit(UUID, TEXT);

CREATE FUNCTION check_weekly_limit(
  p_linkedin_account_id UUID,
  p_action_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_account RECORD;
  v_would_exceed BOOLEAN;
BEGIN
  SELECT 
    account_type,
    this_week_connections,
    this_week_messages,
    weekly_connection_limit,
    weekly_message_limit,
    week_reset_at
  INTO v_account
  FROM linkedin_accounts
  WHERE id = p_linkedin_account_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Auto-reset counters if week has rolled over
  IF v_account.week_reset_at < date_trunc('week', NOW()) THEN
    UPDATE linkedin_accounts
    SET 
      this_week_connections = 0,
      this_week_messages = 0,
      week_reset_at = date_trunc('week', NOW())
    WHERE id = p_linkedin_account_id;
    
    v_account.this_week_connections := 0;
    v_account.this_week_messages := 0;
  END IF;

  IF p_action_type = 'connect' THEN
    v_would_exceed := (v_account.this_week_connections + 1) > v_account.weekly_connection_limit;
  ELSIF p_action_type = 'message' THEN
    v_would_exceed := (v_account.this_week_messages + 1) > v_account.weekly_message_limit;
  ELSE
    v_would_exceed := FALSE;
  END IF;

  RETURN NOT v_would_exceed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_weekly_limit IS 'Checks if an action would exceed the weekly limit for a LinkedIn account';

-- 6. Update increment_action_count to also track weekly counters on linkedin_accounts
-- Drop ALL existing overloads explicitly to avoid ambiguity
DROP FUNCTION IF EXISTS increment_action_count(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS increment_action_count(UUID, UUID, TEXT, DATE);

-- 6a. Create the 3-arg version (used by the Python worker)
CREATE FUNCTION increment_action_count(
  p_workspace_id UUID,
  p_linkedin_account_id UUID,
  p_action_type TEXT
)
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  -- Update daily counts
  INSERT INTO daily_action_counts (
    workspace_id,
    linkedin_account_id,
    date,
    connection_requests,
    messages_sent
  )
  VALUES (
    p_workspace_id,
    p_linkedin_account_id,
    v_today,
    CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END
  )
  ON CONFLICT (linkedin_account_id, date)
  DO UPDATE SET
    connection_requests = daily_action_counts.connection_requests + 
      CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    messages_sent = daily_action_counts.messages_sent + 
      CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
    updated_at = NOW();

  -- Update weekly counts
  INSERT INTO weekly_action_counts (
    workspace_id,
    linkedin_account_id,
    week_start_date,
    connection_requests,
    messages_sent
  )
  VALUES (
    p_workspace_id,
    p_linkedin_account_id,
    v_week_start,
    CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END
  )
  ON CONFLICT (linkedin_account_id, week_start_date)
  DO UPDATE SET
    connection_requests = weekly_action_counts.connection_requests + 
      CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    messages_sent = weekly_action_counts.messages_sent + 
      CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  -- Update linkedin_accounts table for UI display (daily + weekly)
  UPDATE linkedin_accounts
  SET
    today_connections = CASE 
      WHEN p_action_type = 'connect' THEN COALESCE(today_connections, 0) + 1
      ELSE COALESCE(today_connections, 0)
    END,
    today_messages = CASE 
      WHEN p_action_type IN ('message', 'inmail') THEN COALESCE(today_messages, 0) + 1
      ELSE COALESCE(today_messages, 0)
    END,
    this_week_connections = CASE 
      WHEN p_action_type = 'connect' THEN COALESCE(this_week_connections, 0) + 1
      ELSE COALESCE(this_week_connections, 0)
    END,
    this_week_messages = CASE 
      WHEN p_action_type IN ('message', 'inmail') THEN COALESCE(this_week_messages, 0) + 1
      ELSE COALESCE(this_week_messages, 0)
    END,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = p_linkedin_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6b. Recreate the 4-arg version (with optional date param) for backwards compatibility
CREATE FUNCTION increment_action_count(
  p_workspace_id UUID,
  p_linkedin_account_id UUID,
  p_action_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Delegate to the 3-arg version (date param is unused now)
  PERFORM increment_action_count(p_workspace_id, p_linkedin_account_id, p_action_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_action_count(UUID, UUID, TEXT) IS 'Increments action counters in daily_action_counts, weekly_action_counts, and linkedin_accounts tables after successful execution';

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_account_type ON linkedin_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_week_reset ON linkedin_accounts(week_reset_at);

-- 8. Add comments for documentation
COMMENT ON COLUMN linkedin_accounts.account_type IS 'LinkedIn account subscription type: free, premium, sales_navigator, or recruiter';
COMMENT ON COLUMN linkedin_accounts.weekly_connection_limit IS 'Maximum connection requests allowed per week (Monday-Sunday)';
COMMENT ON COLUMN linkedin_accounts.weekly_message_limit IS 'Maximum messages allowed per week (Monday-Sunday)';
COMMENT ON COLUMN linkedin_accounts.this_week_connections IS 'Connection requests sent this week (resets Monday)';
COMMENT ON COLUMN linkedin_accounts.this_week_messages IS 'Messages sent this week (resets Monday)';
COMMENT ON COLUMN linkedin_accounts.week_reset_at IS 'Timestamp when weekly counters were last reset (Monday 00:00:00)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Account type and weekly limits have been added to linkedin_accounts table.';
END $$;
