"""
Rate limiting utilities for LinkedIn campaign actions.

Implements:
1. Weekly limit tracking (200 connection requests/week)
2. Natural timing with random jitter
3. Cross-campaign rate limit enforcement
4. Auto-retry on rate limits
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from utils.logger import logger


def calculate_next_action_time(
    base_time: datetime,
    delay_hours: int = 24,
    jitter_minutes: int = 30
) -> datetime:
    """
    Calculate next action time with random jitter for natural behavior.
    
    Args:
        base_time: Starting time
        delay_hours: Base delay in hours
        jitter_minutes: Random jitter range (±minutes)
    
    Returns:
        Scheduled time with jitter applied
    """
    # Generate random jitter between -jitter_minutes and +jitter_minutes
    random_jitter = random.randint(-jitter_minutes, jitter_minutes)
    
    next_time = base_time + timedelta(
        hours=delay_hours,
        minutes=random_jitter
    )
    
    logger.debug(
        f"Calculated next action: base={base_time.isoformat()}, "
        f"delay={delay_hours}h, jitter={random_jitter}m, "
        f"result={next_time.isoformat()}"
    )
    
    return next_time


def get_week_start_date(check_date: Optional[datetime] = None) -> datetime:
    """
    Get the Monday of the week containing check_date.
    
    Args:
        check_date: Date to check (defaults to today)
    
    Returns:
        Monday of that week at 00:00:00 UTC
    """
    if check_date is None:
        check_date = datetime.now(timezone.utc)
    
    # Get day of week (0=Monday, 6=Sunday)
    days_since_monday = check_date.weekday()
    
    # Subtract days to get to Monday
    monday = check_date - timedelta(days=days_since_monday)
    
    # Reset to start of day
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def check_rate_limits(
    supabase,
    linkedin_account_id: str,
    action_type: str,
    daily_limit: int = 100,
    weekly_limit: int = 200
) -> dict:
    """
    Check if an action would exceed daily or weekly rate limits.
    
    Uses the database function for accurate cross-campaign tracking.
    
    Args:
        supabase: Supabase client
        linkedin_account_id: Account to check
        action_type: Type of action (connect, message, etc.)
        daily_limit: Daily limit for this action type
        weekly_limit: Weekly limit (only for connection requests)
    
    Returns:
        Dict with:
        - allowed (bool): Whether action is allowed
        - daily_count (int): Current daily count
        - weekly_count (int): Current weekly count
        - reason (str): Reason if not allowed
    """
    try:
        # First, get the account to check its limits and counters
        account_response = supabase.table('linkedin_accounts').select(
            'account_type, daily_connection_limit, daily_message_limit, '
            'weekly_connection_limit, weekly_message_limit, '
            'today_connections, today_messages, '
            'this_week_connections, this_week_messages, '
            'week_reset_at'
        ).eq('id', linkedin_account_id).single().execute()
        
        if not account_response.data:
            logger.warning(f"Account {linkedin_account_id} not found")
            return {
                "allowed": False,
                "daily_count": 0,
                "weekly_count": 0,
                "reason": "account_not_found"
            }
        
        account = account_response.data
        
        # Use account-specific limits (user can override defaults)
        if action_type == 'connect':
            daily_limit = account.get('daily_connection_limit', 15)
            weekly_limit = account.get('weekly_connection_limit', 105)
            daily_count = account.get('today_connections', 0)
            weekly_count = account.get('this_week_connections', 0)
        elif action_type == 'message':
            daily_limit = account.get('daily_message_limit', 30)
            weekly_limit = account.get('weekly_message_limit', 300)
            daily_count = account.get('today_messages', 0)
            weekly_count = account.get('this_week_messages', 0)
        else:
            daily_count = 0
            weekly_count = 0
        
        # Check if limits would be exceeded
        daily_exceeded = daily_count >= daily_limit
        weekly_exceeded = weekly_count >= weekly_limit
        
        allowed = not (daily_exceeded or weekly_exceeded)
        
        # Determine reason if not allowed
        reason = "ok"
        if daily_exceeded:
            reason = "daily_limit_reached"
        elif weekly_exceeded:
            reason = "weekly_limit_reached"
        
        return {
            "allowed": allowed,
            "daily_count": daily_count,
            "weekly_count": weekly_count,
            "daily_limit": daily_limit,
            "weekly_limit": weekly_limit,
            "account_type": account.get('account_type', 'free'),
            "reason": reason
        }
    
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        # Fail safe - allow action but log warning
        return {
            "allowed": True,
            "daily_count": 0,
            "weekly_count": 0,
            "reason": "check_error",
            "error": str(e)
        }


def increment_action_count(
    supabase,
    workspace_id: str,
    linkedin_account_id: str,
    action_type: str
) -> None:
    """
    Increment action counters after successful execution.
    
    Updates both daily and weekly counters in the database.
    
    Args:
        supabase: Supabase client
        workspace_id: Workspace ID
        linkedin_account_id: Account ID
        action_type: Type of action executed
    """
    try:
        supabase.rpc(
            "increment_action_count",
            {
                "p_workspace_id": workspace_id,
                "p_linkedin_account_id": linkedin_account_id,
                "p_action_type": action_type
            }
        ).execute()
        
        logger.info(
            f"Incremented {action_type} counter for account {linkedin_account_id}"
        )
    
    except Exception as e:
        logger.error(f"Failed to increment action count: {e}")
        # Non-fatal - action already executed


def calculate_retry_time(
    retry_count: int,
    base_delay_minutes: int = 60,
    max_delay_hours: int = 24
) -> datetime:
    """
    Calculate retry time with exponential backoff.
    
    Args:
        retry_count: Number of retries so far
        base_delay_minutes: Base delay for first retry
        max_delay_hours: Maximum delay cap
    
    Returns:
        Scheduled retry time
    """
    # Exponential backoff: 1h, 2h, 4h, 8h, 24h (capped)
    delay_minutes = min(
        base_delay_minutes * (2 ** retry_count),
        max_delay_hours * 60
    )
    
    # Add jitter (±10%)
    jitter = random.uniform(-0.1, 0.1) * delay_minutes
    total_delay = delay_minutes + jitter
    
    retry_time = datetime.now(timezone.utc) + timedelta(minutes=total_delay)
    
    logger.info(
        f"Retry #{retry_count + 1} scheduled for {retry_time.isoformat()} "
        f"(delay: {total_delay:.0f}m)"
    )
    
    return retry_time


def should_retry_error(error: Exception, status_code: Optional[int] = None) -> bool:
    """
    Determine if an error is retryable.
    
    Args:
        error: Exception that occurred
        status_code: HTTP status code if applicable
    
    Returns:
        True if should retry, False if terminal error
    """
    # Terminal errors - don't retry
    terminal_errors = [
        "ProfileNotFoundError",
        "AccountRestrictedError",
        "SessionExpiredError",
        "InvalidCredentialsError"
    ]
    
    error_name = type(error).__name__
    if error_name in terminal_errors:
        return False
    
    # HTTP status codes
    if status_code:
        # Don't retry client errors (except 429 rate limit)
        if 400 <= status_code < 500 and status_code != 429:
            return False
    
    # Retry all other errors (network, 5xx, 429, etc.)
    return True


def get_rate_limit_info(error_response: dict) -> dict:
    """
    Extract rate limit information from error response.
    
    Args:
        error_response: Error response from API
    
    Returns:
        Dict with retry_after (seconds) and reason
    """
    # Try to extract retry-after header or response data
    retry_after = error_response.get("retry_after")
    
    if retry_after:
        try:
            return {
                "retry_after": int(retry_after),
                "reason": "rate_limit_header"
            }
        except (ValueError, TypeError):
            pass
    
    # Default: retry after 1 hour
    return {
        "retry_after": 3600,
        "reason": "rate_limit_default"
    }


def is_within_active_hours(
    campaign_settings: dict,
    check_time: Optional[datetime] = None
) -> bool:
    """
    Check if current time is within campaign's active hours.
    
    Args:
        campaign_settings: Campaign settings with timezone and activeHours
        check_time: Time to check (defaults to now)
    
    Returns:
        True if within active hours
    """
    if check_time is None:
        check_time = datetime.now(timezone.utc)
    
    # Get campaign timezone and active hours
    tz_str = campaign_settings.get("timezone", "UTC")
    active_hours = campaign_settings.get("activeHours", {})
    
    if not active_hours:
        return True  # No restrictions
    
    start_time = active_hours.get("start", "09:00")
    end_time = active_hours.get("end", "17:00")
    
    try:
        # Convert to campaign timezone
        # Note: For production, use pytz or zoneinfo for proper timezone handling
        # This is a simplified version
        
        hour = check_time.hour
        start_hour = int(start_time.split(":")[0])
        end_hour = int(end_time.split(":")[0])
        
        return start_hour <= hour < end_hour
    
    except Exception as e:
        logger.warning(f"Failed to check active hours: {e}")
        return True  # Fail open


def calculate_next_available_slot(
    campaign_settings: dict,
    base_time: Optional[datetime] = None
) -> datetime:
    """
    Calculate next available time slot within active hours.
    
    Args:
        campaign_settings: Campaign settings
        base_time: Starting time (defaults to now)
    
    Returns:
        Next available time within active hours
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc)
    
    # If within active hours, return base_time
    if is_within_active_hours(campaign_settings, base_time):
        return base_time
    
    # Otherwise, schedule for start of next active period
    active_hours = campaign_settings.get("activeHours", {})
    start_time = active_hours.get("start", "09:00")
    
    try:
        start_hour = int(start_time.split(":")[0])
        start_minute = int(start_time.split(":")[1])
        
        # Schedule for tomorrow at start time
        next_slot = base_time.replace(
            hour=start_hour,
            minute=start_minute,
            second=0,
            microsecond=0
        )
        
        # If that's in the past, add a day
        if next_slot <= base_time:
            next_slot += timedelta(days=1)
        
        return next_slot
    
    except Exception as e:
        logger.warning(f"Failed to calculate next slot: {e}")
        return base_time + timedelta(hours=1)
