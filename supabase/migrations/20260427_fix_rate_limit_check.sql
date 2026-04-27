-- Fix check_rate_limits function to handle NULL counts properly

CREATE OR REPLACE FUNCTION check_rate_limits(
  p_linkedin_account_id UUID,
  p_action_type TEXT,
  p_daily_limit INT DEFAULT 100,
  p_weekly_limit INT DEFAULT 200
)
RETURNS JSONB AS $
DECLARE
  v_daily_count INT := 0;  -- Initialize to 0
  v_weekly_count INT := 0;  -- Initialize to 0
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
  
  -- If no row found, v_daily_count will be NULL, so coalesce it
  v_daily_count := COALESCE(v_daily_count, 0);
  
  -- Get weekly count for connection requests
  IF p_action_type = 'connect' THEN
    SELECT COALESCE(connection_requests, 0)
    INTO v_weekly_count
    FROM weekly_action_counts
    WHERE linkedin_account_id = p_linkedin_account_id
      AND week_start_date = v_week_start;
    
    -- If no row found, v_weekly_count will be NULL, so coalesce it
    v_weekly_count := COALESCE(v_weekly_count, 0);
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
$ LANGUAGE plpgsql SECURITY DEFINER;
