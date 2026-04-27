-- ============================================================
-- Campaign Rate Limiting Enhancements
-- Adds weekly limits, cross-campaign tracking, and retry logic
-- ============================================================

-- 1. Add weekly limit tracking to campaigns table
ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS weekly_limit INT DEFAULT 200,
  ADD COLUMN IF NOT EXISTS weekly_message_limit INT DEFAULT 100;

-- 2. Add weekly counters to campaign_enrollments
ALTER TABLE campaign_enrollments
  ADD COLUMN IF NOT EXISTS actions_this_week INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_start_date DATE DEFAULT CURRENT_DATE;

-- 3. Add retry scheduling fields to action_queue
ALTER TABLE action_queue
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_reason TEXT;

-- Update existing scheduled_at to scheduled_for if not already set
UPDATE action_queue SET scheduled_for = scheduled_at WHERE scheduled_for IS NULL;

-- 4. Create daily action counts table for cross-campaign rate limiting
CREATE TABLE IF NOT EXISTS daily_action_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  connection_requests INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  profile_views INT DEFAULT 0,
  inmails_sent INT DEFAULT 0,
  post_likes INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(linkedin_account_id, date)
);

-- 5. Create weekly action counts table
CREATE TABLE IF NOT EXISTS weekly_action_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  connection_requests INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  inmails_sent INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(linkedin_account_id, week_start_date)
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_counts_account_date 
  ON daily_action_counts(linkedin_account_id, date);

CREATE INDEX IF NOT EXISTS idx_weekly_counts_account_week 
  ON weekly_action_counts(linkedin_account_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_action_queue_scheduled 
  ON action_queue(scheduled_for, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_action_queue_retry 
  ON action_queue(linkedin_account_id, retry_count, status)
  WHERE status IN ('pending', 'failed');

-- 7. Add RLS policies
ALTER TABLE daily_action_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_action_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_select" ON daily_action_counts
  FOR SELECT USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "workspace_mutate" ON daily_action_counts
  FOR ALL USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "workspace_select" ON weekly_action_counts
  FOR SELECT USING (workspace_id IN (SELECT auth_user_workspace_ids()));

CREATE POLICY "workspace_mutate" ON weekly_action_counts
  FOR ALL USING (workspace_id IN (SELECT auth_user_workspace_ids()));

-- 8. Create function to get current week start (Monday)
CREATE OR REPLACE FUNCTION get_week_start_date(check_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  -- Returns the Monday of the week containing check_date
  RETURN check_date - (EXTRACT(DOW FROM check_date)::INT + 6) % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Create function to check if action is within rate limits
CREATE OR REPLACE FUNCTION check_rate_limits(
  p_linkedin_account_id UUID,
  p_action_type TEXT,
  p_daily_limit INT DEFAULT 100,
  p_weekly_limit INT DEFAULT 200
)
RETURNS JSONB AS $$
DECLARE
  v_daily_count INT;
  v_weekly_count INT;
  v_week_start DATE;
BEGIN
  v_week_start := get_week_start_date(CURRENT_DATE);
  
  -- Get daily count for this action type
  SELECT COALESCE(
    CASE p_action_type
      WHEN 'connect' THEN connection_requests
      WHEN 'message' THEN messages_sent
      WHEN 'view_profile' THEN profile_views
      WHEN 'inmail' THEN inmails_sent
      WHEN 'like_post' THEN post_likes
      ELSE 0
    END, 0
  )
  INTO v_daily_count
  FROM daily_action_counts
  WHERE linkedin_account_id = p_linkedin_account_id
    AND date = CURRENT_DATE;
  
  -- Get weekly count for connection requests
  IF p_action_type = 'connect' THEN
    SELECT COALESCE(connection_requests, 0)
    INTO v_weekly_count
    FROM weekly_action_counts
    WHERE linkedin_account_id = p_linkedin_account_id
      AND week_start_date = v_week_start;
  ELSE
    v_weekly_count := 0;
  END IF;
  
  -- Return status
  RETURN jsonb_build_object(
    'allowed', v_daily_count < p_daily_limit AND v_weekly_count < p_weekly_limit,
    'daily_count', v_daily_count,
    'daily_limit', p_daily_limit,
    'weekly_count', v_weekly_count,
    'weekly_limit', p_weekly_limit,
    'reason', CASE
      WHEN v_daily_count >= p_daily_limit THEN 'daily_limit_reached'
      WHEN v_weekly_count >= p_weekly_limit THEN 'weekly_limit_reached'
      ELSE 'ok'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to increment action counts
CREATE OR REPLACE FUNCTION increment_action_count(
  p_workspace_id UUID,
  p_linkedin_account_id UUID,
  p_action_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := get_week_start_date(p_date);
  
  -- Increment daily count
  INSERT INTO daily_action_counts (
    workspace_id,
    linkedin_account_id,
    date,
    connection_requests,
    messages_sent,
    profile_views,
    inmails_sent,
    post_likes
  )
  VALUES (
    p_workspace_id,
    p_linkedin_account_id,
    p_date,
    CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'view_profile' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'inmail' THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'like_post' THEN 1 ELSE 0 END
  )
  ON CONFLICT (linkedin_account_id, date)
  DO UPDATE SET
    connection_requests = daily_action_counts.connection_requests + 
      CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
    messages_sent = daily_action_counts.messages_sent + 
      CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
    profile_views = daily_action_counts.profile_views + 
      CASE WHEN p_action_type = 'view_profile' THEN 1 ELSE 0 END,
    inmails_sent = daily_action_counts.inmails_sent + 
      CASE WHEN p_action_type = 'inmail' THEN 1 ELSE 0 END,
    post_likes = daily_action_counts.post_likes + 
      CASE WHEN p_action_type = 'like_post' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  -- Also update linkedin_accounts table for UI display
  UPDATE linkedin_accounts
  SET
    today_connections = CASE 
      WHEN p_action_type = 'connect' THEN COALESCE(today_connections, 0) + 1
      ELSE COALESCE(today_connections, 0)
    END,
    today_messages = CASE 
      WHEN p_action_type = 'message' OR p_action_type = 'inmail' THEN COALESCE(today_messages, 0) + 1
      ELSE COALESCE(today_messages, 0)
    END,
    updated_at = NOW()
  WHERE id = p_linkedin_account_id;
  
  -- Increment weekly count for connection requests
  IF p_action_type IN ('connect', 'message', 'inmail') THEN
    INSERT INTO weekly_action_counts (
      workspace_id,
      linkedin_account_id,
      week_start_date,
      connection_requests,
      messages_sent,
      inmails_sent
    )
    VALUES (
      p_workspace_id,
      p_linkedin_account_id,
      v_week_start,
      CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
      CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
      CASE WHEN p_action_type = 'inmail' THEN 1 ELSE 0 END
    )
    ON CONFLICT (linkedin_account_id, week_start_date)
    DO UPDATE SET
      connection_requests = weekly_action_counts.connection_requests + 
        CASE WHEN p_action_type = 'connect' THEN 1 ELSE 0 END,
      messages_sent = weekly_action_counts.messages_sent + 
        CASE WHEN p_action_type = 'message' THEN 1 ELSE 0 END,
      inmails_sent = weekly_action_counts.inmails_sent + 
        CASE WHEN p_action_type = 'inmail' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to calculate next action time with jitter
CREATE OR REPLACE FUNCTION calculate_next_action_time(
  p_base_time TIMESTAMPTZ,
  p_delay_hours INT DEFAULT 24,
  p_jitter_minutes INT DEFAULT 30
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_random_jitter INT;
BEGIN
  -- Generate random jitter between -jitter_minutes and +jitter_minutes
  v_random_jitter := floor(random() * (p_jitter_minutes * 2 + 1))::INT - p_jitter_minutes;
  
  RETURN p_base_time + 
    (p_delay_hours || ' hours')::INTERVAL + 
    (v_random_jitter || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 12. Create trigger to reset weekly counters
CREATE OR REPLACE FUNCTION reset_weekly_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.week_start_date < get_week_start_date(CURRENT_DATE) THEN
    NEW.actions_this_week := 0;
    NEW.week_start_date := get_week_start_date(CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reset_weekly_counters
  BEFORE UPDATE ON campaign_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION reset_weekly_counters();

-- 13. Add comments for documentation
COMMENT ON TABLE daily_action_counts IS 'Tracks daily action counts per LinkedIn account for rate limiting across all campaigns';
COMMENT ON TABLE weekly_action_counts IS 'Tracks weekly action counts per LinkedIn account (LinkedIn enforces 200 connection requests/week)';
COMMENT ON FUNCTION check_rate_limits IS 'Checks if an action would exceed daily or weekly rate limits';
COMMENT ON FUNCTION increment_action_count IS 'Increments action counters after successful execution';
COMMENT ON FUNCTION calculate_next_action_time IS 'Calculates next action time with random jitter for natural behavior';
COMMENT ON FUNCTION get_week_start_date IS 'Returns the Monday of the week containing the given date';
