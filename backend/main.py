import asyncio
import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel

from utils.db import get_supabase
from utils.crypto import decrypt_credentials
from utils.logger import logger
from utils.exceptions import (
    LinkedInError, ProfileNotFoundError, AccountRestrictedError,
    SessionExpiredError, ActionTimeoutError, ProxyError
)
from scraper.engine import LinkedInScraper

load_dotenv()

WORKSPACE_AES_SECRET = os.getenv("WORKSPACE_AES_SECRET")
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_ACTIONS", "3"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

app = FastAPI(title="LinkedPilot Playwright Worker")
semaphore = asyncio.Semaphore(MAX_CONCURRENT)
scraper: LinkedInScraper = None


@app.on_event("startup")
async def startup():
    global scraper
    scraper = LinkedInScraper(headless=True)
    await scraper.init_browser()
    logger.info("Playwright browser ready.")


@app.on_event("shutdown")
async def shutdown():
    if scraper:
        await scraper.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


class ProcessRequest(BaseModel):
    action_id: str


@app.post("/process")
async def process_endpoint(req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Called by Supabase Edge Functions to trigger a single action.
    Returns immediately (202) and runs the action in the background.
    """
    logger.info(f"Accepted process request for action_id: {req.action_id}")
    background_tasks.add_task(run_action, req.action_id)
    return {"status": "accepted", "action_id": req.action_id}


# ---------------------------------------------------------------------------
# Core action runner
# ---------------------------------------------------------------------------

async def run_action(action_id: str):
    async with semaphore:
        supabase = get_supabase()

        # Fetch the action + its linked account
        resp = (
            supabase.table("action_queue")
            .select("*, linkedin_accounts(*)")
            .eq("id", action_id)
            .single()
            .execute()
        )
        action = resp.data
        if not action:
            logger.error(f"Action {action_id} not found in database.")
            return

        # Mark as processing
        supabase.table("action_queue").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", action_id).execute()

        retries = 0
        success = False
        last_error = ""

        while retries <= MAX_RETRIES and not success:
            try:
                if retries > 0:
                    logger.info(f"Retrying action {action_id} (Attempt {retries + 1}/{MAX_RETRIES + 1})")
                    # Wait a bit before retry to avoid spamming
                    await asyncio.sleep(5 * retries)

                account = action["linkedin_accounts"]

                # Reset daily counters if new UTC day
                account = _check_and_reset_daily_counters(supabase, account)

                # Enforce daily limits before executing
                _check_limit(account, action["action_type"])

                await _setup_session(account)

                result = await _execute_action(action)

                # Write success
                supabase.table("action_queue").update({
                    "status": "done",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "result": result,
                    "error_message": None
                }).eq("id", action_id).execute()

                # Increment daily counter after confirmed success
                _increment_counter(supabase, account["id"], action["action_type"])

                supabase.table("actions_log").insert({
                    "workspace_id": action["workspace_id"],
                    "action_queue_id": action["id"],
                    "action_type": action["action_type"],
                    "status": "done",
                    "payload": action["payload"],
                    "result": result,
                }).execute()

                logger.info(f"Action {action_id} ({action['action_type']}) completed successfully.")
                success = True

            except (ProfileNotFoundError, AccountRestrictedError, SessionExpiredError) as e:
                # Terminal errors - do not retry
                last_error = str(e)
                logger.error(f"Terminal error for action {action_id}: {last_error}")
                # Mark as failed and log to audit trail
                await _log_failed_action(supabase, action, last_error)
                return  # Exit early, no more retries

            except Exception as e:
                # Retryable errors
                retries += 1
                last_error = str(e)
                logger.warning(f"Retryable error for action {action_id}: {last_error}")
                if retries > MAX_RETRIES:
                    await _log_failed_action(supabase, action, last_error)
                    return  # Exit after max retries


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_session(account: dict):
    """Authenticate the Playwright browser context for the given account."""
    login_method = account.get("login_method")

    if login_method in ("extension", "cookies"):
        cookie_enc = account.get("cookie_encrypted")
        if not cookie_enc:
            raise ValueError("cookie_encrypted is empty for extension/cookies account")
        cookie_str = decrypt_credentials(cookie_enc, WORKSPACE_AES_SECRET)
        await scraper.set_cookies(cookie_str)

    elif login_method == "credentials":
        email = decrypt_credentials(account["li_email_enc"], WORKSPACE_AES_SECRET)
        password = decrypt_credentials(account["li_password_enc"], WORKSPACE_AES_SECRET)
        result = await scraper.login_with_credentials(email, password)
        if not result["success"]:
            raise SessionExpiredError(f"Login failed: {result['error']}")

    else:
        raise ValueError(f"Unknown login_method: {login_method}")


def _is_new_day(reset_at_str: str) -> bool:
    """Return True if reset_at_str is from a previous UTC calendar day."""
    if not reset_at_str:
        return True
    try:
        reset_at = datetime.fromisoformat(reset_at_str.replace("Z", "+00:00"))
        return reset_at.date() < datetime.now(timezone.utc).date()
    except Exception:
        return True


def _check_and_reset_daily_counters(supabase, account: dict) -> dict:
    """
    If connections_reset_at is from a previous day, zero out today_connections
    and today_messages. Returns the (possibly updated) account dict.
    """
    if _is_new_day(account.get("connections_reset_at")):
        now_iso = datetime.now(timezone.utc).isoformat()
        supabase.table("linkedin_accounts").update({
            "today_connections": 0,
            "today_messages": 0,
            "connections_reset_at": now_iso,
        }).eq("id", account["id"]).execute()
        account = {**account, "today_connections": 0, "today_messages": 0}
        logger.info(f"Daily counters reset for account {account['id']}")
    return account


def _check_limit(account: dict, action_type: str):
    """Raise AccountRestrictedError (terminal — no retry) if daily limit reached."""
    if action_type == "connect":
        used = account.get("today_connections", 0)
        limit = account.get("daily_connection_limit", 20)
        if used >= limit:
            raise AccountRestrictedError(
                f"Daily connection limit reached ({used}/{limit}) for account {account['id']}"
            )
    elif action_type == "message":
        used = account.get("today_messages", 0)
        limit = account.get("daily_message_limit", 50)
        if used >= limit:
            raise AccountRestrictedError(
                f"Daily message limit reached ({used}/{limit}) for account {account['id']}"
            )


def _increment_counter(supabase, account_id: str, action_type: str):
    """Increment today_connections or today_messages after a successful action."""
    if action_type == "connect":
        supabase.rpc("increment_today_connections", {"account_id": account_id}).execute()
    elif action_type == "message":
        supabase.rpc("increment_today_messages", {"account_id": account_id}).execute()


async def _execute_action(action: dict) -> dict:
    """Dispatch to the correct Playwright method based on action_type."""
    action_type = action["action_type"]
    payload = action.get("payload") or {}

    if action_type == "view_profile":
        return await scraper.scrape_profile(payload["profile_url"])

    if action_type == "connect":
        return await scraper.send_connection_request(
            payload["profile_url"],
            payload.get("message"),
        )

    if action_type == "message":
        if not payload.get("profile_url") or not payload.get("message"):
            raise ValueError("message action requires profile_url and message in payload")
        return await scraper.send_message(
            payload["profile_url"],
            payload["message"],
        )

    if action_type == "scrapeLeads":
        if not payload.get("search_url"):
            raise ValueError("scrapeLeads action requires search_url in payload")
        return await scraper.scrape_leads_batch(
            payload["search_url"],
            payload.get("max_leads", 50),
        )

    raise ValueError(f"Unknown action_type: {action_type}")


async def _log_failed_action(supabase, action: dict, error_message: str):
    """Log a failed action to both action_queue and actions_log (audit trail)."""
    action_id = action["id"]
    
    # Mark action as failed in queue
    supabase.table("action_queue").update({
        "status": "failed",
        "error_message": error_message,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", action_id).execute()
    
    # Write failure to audit trail (actions_log)
    supabase.table("actions_log").insert({
        "workspace_id": action["workspace_id"],
        "action_queue_id": action_id,
        "action_type": action["action_type"],
        "status": "failed",
        "payload": action.get("payload") or {},
        "result": {"error": error_message},
        "error_message": error_message,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    
    logger.error(f"Action {action_id} ({action['action_type']}) failed and logged to audit trail: {error_message}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting LinkedPilot Worker...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

