"""
Enhanced action runner with rate limiting, retry logic, and natural timing.

Improvements:
1. Weekly limit tracking (200 connection requests/week)
2. Natural timing with random jitter
3. Cross-campaign rate limit enforcement
4. Auto-retry on rate limits with exponential backoff
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from utils.db import get_supabase
from utils.logger import logger
from utils.exceptions import (
    ProfileNotFoundError,
    AccountRestrictedError,
    SessionExpiredError
)
from utils.unipile import UnipileClient
from utils.rate_limiter import (
    check_rate_limits,
    increment_action_count,
    calculate_retry_time,
    should_retry_error,
    get_rate_limit_info,
)


MAX_RETRIES = 3


async def run_action_with_rate_limiting(
    action_id: str,
    semaphore: asyncio.Semaphore,
    unipile_client: UnipileClient
):
    """
    Execute a single action with full rate limiting and retry logic.
    
    Features:
    - Checks daily and weekly rate limits before execution
    - Adds natural timing jitter
    - Auto-retries on rate limit errors
    - Reschedules if limits exceeded
    - Tracks execution across all campaigns
    """
    async with semaphore:
        supabase = get_supabase()

        # Fetch the action + its linked account and campaign
        try:
            resp = (
                supabase.table("action_queue")
                .select("*, linkedin_accounts(*), campaigns(*)")
                .eq("id", action_id)
                .single()
                .execute()
            )
            action = resp.data
        except Exception as e:
            logger.error(f"Failed to fetch action {action_id}: {e}")
            return

        if not action:
            logger.error(f"Action {action_id} not found in database.")
            return

        account = action.get("linkedin_accounts")
        campaign = action.get("campaigns")
        
        if not account:
            logger.error(f"Action {action_id} has no linked account.")
            await _mark_failed(supabase, action_id, "no_account")
            return

        # Mark as processing
        supabase.table("action_queue").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", action_id).execute()

        # Check rate limits BEFORE execution
        rate_check = await _check_rate_limits_before_action(
            supabase, action, account, campaign
        )
        
        if not rate_check["allowed"]:
            await _handle_rate_limit_exceeded(
                supabase, action, rate_check
            )
            return

        # Execute with retry logic
        result = await _execute_with_retries(
            supabase, action, account, unipile_client
        )

        if result == "skipped":
            # Conditions not met — don't count against daily limits,
            # but still advance the sequence to the next step.
            logger.info(
                f"Action {action['id']} ({action['action_type']}) skipped "
                f"(conditions not met) — counter not incremented."
            )
            await _schedule_next_action(supabase, action)

        elif result:
            # Increment counters after successful execution
            increment_action_count(
                supabase,
                action["workspace_id"],
                account["id"],
                action["action_type"]
            )
            
            # Schedule next action in sequence if applicable
            await _schedule_next_action(supabase, action)


async def _check_rate_limits_before_action(
    supabase,
    action: dict,
    account: dict,
    campaign: Optional[dict]
) -> dict:
    """
    Check if action is within rate limits.
    
    Returns dict with:
    - allowed (bool)
    - reason (str)
    - daily_count, weekly_count, etc.
    """
    action_type = action["action_type"]
    
    # Get limits from campaign or use defaults
    if campaign:
        daily_limit = campaign.get("daily_limit", 20)
        weekly_limit = campaign.get("weekly_limit", 200)
    else:
        # Fallback to account limits
        daily_limit = account.get("daily_connection_limit", 20)
        weekly_limit = 200
    
    # Check using database function (cross-campaign tracking)
    rate_check = check_rate_limits(
        supabase,
        account["id"],
        action_type,
        daily_limit=daily_limit,
        weekly_limit=weekly_limit
    )
    
    if not rate_check["allowed"]:
        logger.warning(
            f"Rate limit check failed for action {action['id']}: "
            f"{rate_check.get('reason')} "
            f"(daily: {rate_check.get('daily_count')}/{daily_limit}, "
            f"weekly: {rate_check.get('weekly_count')}/{weekly_limit})"
        )
    
    return rate_check


async def _handle_rate_limit_exceeded(
    supabase,
    action: dict,
    rate_check: dict
):
    """
    Reschedule action when rate limit is exceeded.
    """
    reason = rate_check.get("reason", "rate_limit")
    
    # Calculate when to retry based on limit type
    if reason == "weekly_limit_reached":
        # Reschedule for next week
        retry_time = calculate_retry_time(0, base_delay_minutes=7 * 24 * 60)
        logger.info(
            f"Weekly limit reached for action {action['id']}, "
            f"rescheduling to {retry_time.isoformat()}"
        )
    else:
        # Daily limit - retry tomorrow
        retry_time = calculate_retry_time(0, base_delay_minutes=24 * 60)
        logger.info(
            f"Daily limit reached for action {action['id']}, "
            f"rescheduling to {retry_time.isoformat()}"
        )
    
    # Update action to pending with new schedule
    supabase.table("action_queue").update({
        "status": "pending",
        "scheduled_at": retry_time.isoformat(),
        "retry_reason": reason,
        "error_message": f"Rate limit exceeded: {reason}"
    }).eq("id", action["id"]).execute()


async def _execute_with_retries(
    supabase,
    action: dict,
    account: dict,
    unipile_client: UnipileClient
) -> bool:
    """
    Execute action with retry logic.
    
    Returns True if successful, False otherwise.
    """
    retry_count = action.get("retry_count", 0)
    max_retries = action.get("max_retries", MAX_RETRIES)
    
    while retry_count <= max_retries:
        try:
            if retry_count > 0:
                logger.info(
                    f"Retrying action {action['id']} "
                    f"(Attempt {retry_count + 1}/{max_retries + 1})"
                )
                # Exponential backoff between retries
                await asyncio.sleep(5 * (2 ** retry_count))

            # Add natural delay before execution (30-90 seconds)
            delay_secs = random.uniform(30, 90)
            logger.info(
                f"Natural delay: waiting {delay_secs:.0f}s before "
                f"executing {action['action_type']}..."
            )
            await asyncio.sleep(delay_secs)

            # Execute the action
            result = await _execute_action(action, account, unipile_client)

            # If the action was skipped due to unmet conditions, do not mark as
            # done and do not increment counters, but DO advance the sequence.
            if isinstance(result, dict) and result.get("skipped"):
                return "skipped"

            # Success!
            supabase.table("action_queue").update({
                "status": "done",
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "result": result,
                "error_message": None,
                "retry_count": retry_count
            }).eq("id", action["id"]).execute()

            # Update lead connection_status if this was a connect action
            if action["action_type"] == "connect" and action.get("lead_id"):
                try:
                    supabase.table("leads").update({
                        "connection_status": "pending"
                    }).eq("id", action["lead_id"]).execute()
                    logger.info(f"Updated lead {action['lead_id']} connection_status to pending")
                except Exception as e:
                    logger.warning(f"Failed to update lead connection_status: {e}")

            # Log to audit trail
            supabase.table("actions_log").insert({
                "workspace_id": action["workspace_id"],
                "action_queue_id": action["id"],
                "campaign_id": action.get("campaign_id"),
                "lead_id": action.get("lead_id"),
                "linkedin_account_id": account["id"],
                "action_type": action["action_type"],
                "status": "done",
                "payload": action.get("payload", {}),
                "result": result,
            }).execute()

            logger.info(
                f"Action {action['id']} ({action['action_type']}) "
                f"completed successfully."
            )
            return True

        except (ProfileNotFoundError, AccountRestrictedError, SessionExpiredError) as e:
            # Terminal errors - do not retry
            logger.error(f"Terminal error for action {action['id']}: {e}")
            await _mark_failed(supabase, action["id"], str(e), is_terminal=True)
            return False

        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            body_text = e.response.text[:500]
            
            logger.error(
                f"HTTP {status} for action {action['id']}: {body_text}"
            )
            
            # Handle rate limiting (429)
            if status == 429:
                await _handle_api_rate_limit(
                    supabase, action, e.response
                )
                return False
            
            # Handle 422 "already_invited_recently" as success
            # This means the invitation was already sent, so we can mark it as done
            if status == 422 and "already_invited_recently" in body_text:
                logger.info(
                    f"Action {action['id']} already completed previously "
                    f"(invitation already sent). Marking as done."
                )
                
                # Mark as done
                supabase.table("action_queue").update({
                    "status": "done",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "result": {"message": "Invitation already sent recently"},
                    "error_message": None,
                    "retry_count": retry_count
                }).eq("id", action["id"]).execute()
                
                # Update lead connection_status if this was a connect action
                if action["action_type"] == "connect" and action.get("lead_id"):
                    try:
                        supabase.table("leads").update({
                            "connection_status": "pending"
                        }).eq("id", action["lead_id"]).execute()
                        logger.info(f"Updated lead {action['lead_id']} connection_status to pending")
                    except Exception as update_error:
                        logger.warning(f"Failed to update lead connection_status: {update_error}")
                
                # Log to audit trail
                supabase.table("actions_log").insert({
                    "workspace_id": action["workspace_id"],
                    "action_queue_id": action["id"],
                    "campaign_id": action.get("campaign_id"),
                    "lead_id": action.get("lead_id"),
                    "linkedin_account_id": account["id"],
                    "action_type": action["action_type"],
                    "status": "done",
                    "payload": action.get("payload", {}),
                    "result": {"message": "Invitation already sent recently"},
                }).execute()
                
                logger.info(
                    f"Action {action['id']} ({action['action_type']}) "
                    f"marked as completed (already invited)."
                )
                return True
            
            # Handle 422 "cannot_resend_yet" — LinkedIn temporary cooldown, retry next day
            if status == 422 and "cannot_resend_yet" in body_text:
                retry_time = datetime.now(timezone.utc) + timedelta(hours=24)
                logger.info(
                    f"Action {action['id']} cannot_resend_yet (LinkedIn cooldown), "
                    f"rescheduling to {retry_time.isoformat()}"
                )
                supabase.table("action_queue").update({
                    "status": "pending",
                    "scheduled_at": retry_time.isoformat(),
                    "retry_reason": "cannot_resend_yet",
                    "error_message": "LinkedIn cooldown: cannot resend invitation yet. Rescheduled for tomorrow."
                }).eq("id", action["id"]).execute()
                return False
            
            # Handle 422 "cannot_resend_within_24hrs" — same as cannot_resend_yet
            if status == 422 and "cannot_resend_within_24hrs" in body_text:
                retry_time = datetime.now(timezone.utc) + timedelta(hours=25)
                logger.info(
                    f"Action {action['id']} cannot_resend_within_24hrs, "
                    f"rescheduling to {retry_time.isoformat()}"
                )
                supabase.table("action_queue").update({
                    "status": "pending",
                    "scheduled_at": retry_time.isoformat(),
                    "retry_reason": "cannot_resend_within_24hrs",
                    "error_message": "LinkedIn: cannot resend within 24hrs. Rescheduled."
                }).eq("id", action["id"]).execute()
                return False

            # Handle 422 "limit_exceeded" — LinkedIn daily/weekly limit, retry tomorrow
            if status == 422 and "limit_exceeded" in body_text:
                retry_time = datetime.now(timezone.utc) + timedelta(hours=24)
                logger.info(
                    f"Action {action['id']} limit_exceeded, "
                    f"rescheduling to {retry_time.isoformat()}"
                )
                supabase.table("action_queue").update({
                    "status": "pending",
                    "scheduled_at": retry_time.isoformat(),
                    "retry_reason": "limit_exceeded",
                    "error_message": "LinkedIn limit exceeded. Rescheduled for tomorrow."
                }).eq("id", action["id"]).execute()
                return False

            # Handle 422 "already_connected" — lead is already a connection, treat as success
            if status == 422 and "already_connected" in body_text:
                logger.info(f"Action {action['id']} lead already connected, marking done.")
                supabase.table("action_queue").update({
                    "status": "done",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "result": {"message": "Already connected"},
                    "error_message": None,
                }).eq("id", action["id"]).execute()
                if action["action_type"] == "connect" and action.get("lead_id"):
                    supabase.table("leads").update({
                        "connection_status": "connected"
                    }).eq("id", action["lead_id"]).execute()
                return True

            # Handle 422 terminal errors — invalid/blocked recipient, can't be retried
            terminal_422_types = [
                "invalid_recipient", "blocked_recipient", "user_unreachable",
                "cannot_invite_attendee", "invalid_account"
            ]
            if status == 422 and any(t in body_text for t in terminal_422_types):
                logger.error(f"Action {action['id']} terminal 422: {body_text[:200]}")
                await _mark_failed(supabase, action["id"], f"HTTP 422: {body_text[:200]}", is_terminal=True)
                return False
            
            # Check if retryable
            if not should_retry_error(e, status):
                await _mark_failed(
                    supabase, action["id"],
                    f"HTTP {status}: {body_text}",
                    is_terminal=True
                )
                return False
            
            # Retry
            retry_count += 1
            if retry_count > max_retries:
                await _mark_failed(
                    supabase, action["id"],
                    f"Max retries exceeded. Last error: HTTP {status}",
                    is_terminal=False
                )
                return False

        except Exception as e:
            # Generic retryable error
            logger.warning(f"Retryable error for action {action['id']}: {e}")
            
            retry_count += 1
            if retry_count > max_retries:
                await _mark_failed(
                    supabase, action["id"],
                    f"Max retries exceeded. Last error: {str(e)}",
                    is_terminal=False
                )
                return False
            
            # Update retry count
            supabase.table("action_queue").update({
                "retry_count": retry_count,
                "last_retry_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", action["id"]).execute()

    return False


async def _handle_api_rate_limit(
    supabase,
    action: dict,
    response: httpx.Response
):
    """
    Handle API rate limit (429) by rescheduling.
    """
    # Try to extract retry-after from response
    rate_info = get_rate_limit_info({
        "retry_after": response.headers.get("retry-after")
    })
    
    retry_after_seconds = rate_info["retry_after"]
    retry_time = datetime.now(timezone.utc) + timedelta(seconds=retry_after_seconds)
    
    logger.info(
        f"API rate limit (429) for action {action['id']}, "
        f"rescheduling to {retry_time.isoformat()} "
        f"(+{retry_after_seconds}s)"
    )
    
    supabase.table("action_queue").update({
        "status": "pending",
        "scheduled_at": retry_time.isoformat(),
        "retry_reason": "api_rate_limit_429",
        "error_message": f"API rate limited, retry after {retry_after_seconds}s"
    }).eq("id", action["id"]).execute()


async def _execute_action(
    action: dict,
    account: dict,
    unipile_client: UnipileClient
) -> dict:
    """
    Execute the actual action via Unipile API.
    """
    action_type = action["action_type"]
    payload = action.get("payload", {})
    unipile_account_id = account.get("unipile_account_id")

    if not unipile_account_id:
        raise ValueError(
            f"Account {account['id']} has no unipile_account_id"
        )
    
    # Get lead data for template variable replacement
    lead_data = {}
    if action.get("lead_id"):
        try:
            supabase = get_supabase()
            lead_response = supabase.table("leads").select(
                "id, first_name, last_name, full_name, company, title, headline, location, linkedin_member_id"
            ).eq("id", action["lead_id"]).single().execute()
            if lead_response.data:
                lead_data = lead_response.data
                if not lead_data.get("first_name") and not lead_data.get("full_name"):
                    logger.warning(f"Lead {action['lead_id']} has no name data for template replacement")
        except Exception as e:
            logger.warning(f"Failed to fetch lead data for template replacement: {e}")
    
    # Evaluate runtime conditions before executing
    conditions = payload.get("_conditions", [])
    if conditions:
        logger.info(f"Evaluating conditions for action {action['id']}: {conditions}")
        if not await _evaluate_conditions(conditions, action.get("lead_id"), action.get("campaign_id")):
            logger.info(f"Skipping action {action['id']} - conditions not met: {conditions}")
            # Mark as skipped instead of failed
            supabase = get_supabase()
            supabase.table("action_queue").update({
                "status": "skipped",
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "error_message": f"Conditions not met: {', '.join(conditions)}"
            }).eq("id", action["id"]).execute()
            return {"skipped": True, "reason": f"Conditions not met: {conditions}"}
    
    # Helper function to replace template variables
    def replace_variables(text: str) -> str:
        if not text:
            return text
        
        # Build replacements from lead data
        first_name = lead_data.get("first_name") or ""
        last_name = lead_data.get("last_name") or ""
        full_name = lead_data.get("full_name") or f"{first_name} {last_name}".strip()
        
        # If first_name is empty but full_name exists, extract it
        if not first_name and full_name:
            first_name = full_name.split(" ")[0]
        
        # If still empty, use "there" as a safe fallback so messages don't
        # go out with literal {{first_name}} in them
        if not first_name:
            logger.warning(
                f"Lead {action.get('lead_id')} has no first_name — "
                f"using 'there' as fallback for {{{{first_name}}}}"
            )
            first_name = "there"
        
        replacements = {
            "{{first_name}}": first_name,
            "{{last_name}}": last_name,
            "{{full_name}}": full_name,
            "{{company}}": lead_data.get("company") or "",
            "{{title}}": lead_data.get("title") or "",
            "{{headline}}": lead_data.get("headline") or "",
            "{{location}}": lead_data.get("location") or "",
            # Also support single-brace format just in case
            "{first_name}": first_name,
            "{last_name}": last_name,
            "{full_name}": full_name,
            "{company}": lead_data.get("company") or "",
        }
        
        result = text
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, value)
        
        return result

    # Dispatch based on action type
    if action_type == "connect":
        provider_id = payload.get("provider_id")
        if not provider_id:
            raise ValueError("connect action requires 'provider_id' in payload")
        message = payload.get("message", "")
        # Replace template variables in connection message
        message = replace_variables(message)
        return await unipile_client.send_invitation(
            unipile_account_id, provider_id, message
        )
    
    elif action_type == "message":
        attendee_id = payload.get("attendee_id")
        if not attendee_id:
            raise ValueError("message action requires 'attendee_id' in payload")
        # Support both 'text' and 'message' field names
        text = payload.get("text") or payload.get("message", "")
        # Replace template variables in message text
        text = replace_variables(text)
        return await unipile_client.start_new_chat(
            unipile_account_id, attendee_id, text
        )
    
    elif action_type == "inmail":
        attendee_id = payload.get("attendee_id")
        if not attendee_id:
            raise ValueError("inmail action requires 'attendee_id' in payload")
        # Support both 'text' and 'message' field names
        text = payload.get("text") or payload.get("message", "")
        # Replace template variables in InMail text
        text = replace_variables(text)
        return await unipile_client.send_inmail(
            unipile_account_id, attendee_id, text
        )
    
    elif action_type == "view_profile":
        identifier = payload.get("identifier")
        return await unipile_client.get_profile(
            unipile_account_id, identifier
        )
    
    elif action_type == "like_post":
        post_id = payload.get("post_id")
        return await unipile_client.react_to_post(
            unipile_account_id, post_id, "LIKE"
        )
    
    else:
        raise ValueError(f"Unknown action type: {action_type}")


async def _evaluate_conditions(
    conditions: list,
    lead_id: str,
    campaign_id: str
) -> bool:
    """
    Evaluate if ALL conditions are met for this lead.
    
    Conditions:
    - 'accepted': lead.connection_status == 'connected'
    - 'not_accepted': lead.connection_status != 'connected'
    - 'replied': has inbound message in this campaign
    - 'not_replied': no inbound messages in this campaign
    - 'connected': lead was connected before enrollment (check enrollment created_at vs connection)
    - 'not_connected': lead was not connected at enrollment
    
    Returns True if ALL conditions are met, False otherwise.
    """
    if not conditions:
        return True  # No conditions = always execute
    
    if not lead_id:
        logger.warning("Cannot evaluate conditions without lead_id")
        return False
    
    supabase = get_supabase()
    
    try:
        # Fetch lead data
        lead_response = supabase.table("leads").select("connection_status").eq("id", lead_id).single().execute()
        if not lead_response.data:
            logger.warning(f"Lead {lead_id} not found for condition evaluation")
            return False
        
        lead = lead_response.data
        connection_status = lead.get("connection_status", "none")
        
        # Evaluate each condition
        for condition in conditions:
            if condition == "accepted":
                if connection_status != "connected":
                    logger.info(f"Condition 'accepted' not met: connection_status={connection_status}")
                    return False
            
            elif condition == "not_accepted":
                if connection_status == "connected":
                    logger.info(f"Condition 'not_accepted' not met: connection_status={connection_status}")
                    return False
            
            elif condition == "replied":
                if campaign_id:
                    messages_response = supabase.table("messages").select("id").eq("lead_id", lead_id).eq("campaign_id", campaign_id).eq("direction", "inbound").limit(1).execute()
                    if not messages_response.data:
                        logger.info(f"Condition 'replied' not met: no inbound messages found")
                        return False
                else:
                    logger.warning("Cannot check 'replied' condition without campaign_id")
                    return False
            
            elif condition == "not_replied":
                if campaign_id:
                    messages_response = supabase.table("messages").select("id").eq("lead_id", lead_id).eq("campaign_id", campaign_id).eq("direction", "inbound").limit(1).execute()
                    if messages_response.data:
                        logger.info(f"Condition 'not_replied' not met: inbound messages found")
                        return False
                else:
                    logger.warning("Cannot check 'not_replied' condition without campaign_id")
                    return False
            
            elif condition == "connected":
                # Lead was already connected before campaign
                if connection_status != "connected":
                    logger.info(f"Condition 'connected' not met: connection_status={connection_status}")
                    return False
            
            elif condition == "not_connected":
                # Lead was not connected before campaign
                if connection_status == "connected":
                    logger.info(f"Condition 'not_connected' not met: connection_status={connection_status}")
                    return False
            
            else:
                logger.warning(f"Unknown condition: {condition}")
                # Unknown conditions are treated as not met for safety
                return False
        
        # All conditions met
        logger.info(f"All conditions met: {conditions}")
        return True
    
    except Exception as e:
        logger.error(f"Error evaluating conditions: {e}")
        return False


async def _mark_failed(
    supabase,
    action_id: str,
    error_message: str,
    is_terminal: bool = False
):
    """
    Mark action as failed.
    """
    supabase.table("action_queue").update({
        "status": "failed",
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "error_message": error_message
    }).eq("id", action_id).execute()
    
    logger.error(
        f"Action {action_id} failed "
        f"({'terminal' if is_terminal else 'after retries'}): "
        f"{error_message}"
    )


async def _schedule_next_action(
    supabase,
    completed_action: dict,
):
    """
    Advance the enrollment's current_step counter and mark it completed when
    all its action_queue rows are finished.

    NOTE: process-campaign/index.ts pre-queues ALL steps for every enrollment
    at launch time (with correct scheduled_at and _conditions).  This function
    must NOT insert new queue rows — doing so would duplicate every step.
    Its only jobs are:
      1. Increment current_step on the enrollment.
      2. Check whether every action_queue row for this enrollment is terminal
         (done / skipped / failed).  If so, mark the enrollment completed.
    """
    if not completed_action.get("campaign_enrollment_id"):
        return

    enrollment_id = completed_action["campaign_enrollment_id"]

    try:
        # Bump current_step
        enrollment = supabase.table("campaign_enrollments").select(
            "id, current_step, workspace_id, campaign_id"
        ).eq("id", enrollment_id).single().execute().data

        if not enrollment:
            return

        next_step = enrollment.get("current_step", 0) + 1
        supabase.table("campaign_enrollments").update({
            "current_step": next_step,
        }).eq("id", enrollment_id).execute()

        # Check if all queue rows for this enrollment are terminal
        remaining = supabase.table("action_queue").select("id").eq(
            "campaign_enrollment_id", enrollment_id
        ).in_("status", ["pending", "processing"]).limit(1).execute()

        if not remaining.data:
            # Every step is done / skipped / failed — enrollment is complete
            supabase.table("campaign_enrollments").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", enrollment_id).execute()
            logger.info(
                f"Enrollment {enrollment_id} completed "
                f"(all {next_step} steps finished)."
            )
        else:
            logger.info(
                f"Enrollment {enrollment_id} advanced to step {next_step}; "
                f"next pending action will execute at its scheduled_at time."
            )

    except Exception as e:
        logger.error(f"Failed to advance enrollment {enrollment_id}: {e}")
