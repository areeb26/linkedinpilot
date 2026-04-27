-- Fix increment_action_count to also update linkedin_accounts table
-- This ensures the UI displays correct daily usage counters

DROP FUNCTION IF EXISTS increment_action_count(UUID, UUID, TEXT, DATE);

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
  -- Get week start date (Monday)
  SELECT get_week_start_date(p_date) INTO v_week_start;
  
  -- Increment daily count in daily_action_counts table
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_action_count IS 'Increments action counters in both daily_action_counts and linkedin_accounts tables after successful execution';
