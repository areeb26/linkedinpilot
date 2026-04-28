import asyncio
import os
import random
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
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
from utils.unipile import UnipileClient
from utils.action_runner import run_action_with_rate_limiting
# from scraper.engine import LinkedInScraper  # dormant — Unipile handles all actions

load_dotenv()

WORKSPACE_AES_SECRET = os.getenv("WORKSPACE_AES_SECRET")
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_ACTIONS", "3"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    global semaphore
    # Startup — create semaphore inside the running event loop (required for Python 3.10+)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    logger.info("LinkedPilot Worker ready (Unipile mode — no browser required).")
    yield
    # Shutdown
    logger.info("LinkedPilot Worker shutting down.")

app = FastAPI(title="LinkedPilot Worker", lifespan=lifespan)
semaphore: asyncio.Semaphore = None  # Initialized in lifespan startup
unipile_client = UnipileClient()

# Allow all origins (needed for ngrok/localtunnel tunnels)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Unipile proxy endpoints — all Unipile API calls are routed through here
# so the API key and DSN are never exposed to the browser network tab.
# ---------------------------------------------------------------------------

from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Any, Optional


class SearchRequest(BaseModel):
    account_id: str
    limit: Optional[int] = 25
    body: dict = {}


class SearchParamsRequest(BaseModel):
    account_id: str
    type: str
    keywords: Optional[str] = None
    limit: Optional[int] = 100


class UnipileProxyRequest(BaseModel):
    method: str = "GET"
    path: str
    account_id: Optional[str] = None
    params: Optional[dict] = None
    body: Optional[Any] = None


@app.post("/api/linkedin/search")
async def proxy_linkedin_search(req: SearchRequest):
    """
    Proxy POST /linkedin/search — keeps Unipile API key server-side.
    Frontend sends: { account_id, limit, body: { api, category, keywords, ...filters } }
    Unipile expects limit inside the JSON body, not as a query param.
    """
    try:
        # Merge limit into the body — Unipile search expects it there
        search_body = {**req.body, "limit": req.limit}
        result = await unipile_client._request(
            "POST",
            "/linkedin/search",
            params={"account_id": req.account_id},
            json=search_body,
        )
        return result
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            status_code=e.response.status_code,
            content={"error": e.response.text[:500], "status": e.response.status_code},
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/linkedin/search/parameters")
async def proxy_linkedin_search_parameters(
    account_id: str,
    type: str,
    keywords: Optional[str] = None,
    limit: Optional[int] = 100,
    service: Optional[str] = None,
):
    """
    Proxy GET /linkedin/search/parameters — keeps Unipile API key server-side.
    The 'service' parameter (CLASSIC, SALES_NAVIGATOR, RECRUITER) is passed to Unipile
    to get tier-specific filter options.
    """
    try:
        params = {"account_id": account_id, "type": type, "limit": limit}
        if keywords:
            params["keywords"] = keywords
        if service:
            params["service"] = service
        result = await unipile_client._request("GET", "/linkedin/search/parameters", params=params)
        return result
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            status_code=e.response.status_code,
            content={"error": e.response.text[:500], "status": e.response.status_code},
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/proxy")
async def proxy_unipile(req: UnipileProxyRequest):
    """
    Generic Unipile proxy for all other API calls (accounts, messaging, profiles, etc.).
    Frontend sends: { method, path, account_id?, params?, body? }

    FormData endpoints (chats, posts) are handled automatically — the backend
    uses the UnipileClient which already knows which endpoints need FormData.
    """
    try:
        kwargs: dict = {}
        params = req.params or {}
        if req.account_id:
            params["account_id"] = req.account_id
        if params:
            kwargs["params"] = params

        path = req.path
        method = req.method.upper()
        body = req.body

        # Route to the appropriate UnipileClient method for FormData endpoints
        # so the backend handles multipart correctly instead of sending JSON.
        if method == "POST" and path.startswith("/chats") and path.endswith("/messages"):
            chat_id = path.split("/")[2]
            account_id = (body or {}).get("account_id") or req.account_id or ""
            text = (body or {}).get("text", "")
            return await unipile_client.send_message(chat_id, text, account_id)

        if method == "POST" and path == "/chats":
            account_id = (body or {}).get("account_id") or req.account_id or ""
            attendees = (body or {}).get("attendees_ids", [])
            text = (body or {}).get("text", "")
            options = (body or {}).get("options")
            if options and options.get("linkedin", {}).get("inmail"):
                api = options["linkedin"].get("api", "classic")
                return await unipile_client.send_inmail(account_id, attendees[0] if attendees else "", text, api)
            else:
                if attendees:
                    chat_id = await unipile_client.get_or_create_chat(account_id, attendees[0])
                    return await unipile_client.send_message(chat_id, text, account_id)
                return await unipile_client.start_new_chat(account_id, "", text)

        if method == "POST" and path == "/posts":
            account_id = (body or {}).get("account_id") or req.account_id or ""
            text = (body or {}).get("text", "")
            return await unipile_client.create_post(account_id, text)

        # Handle received invitations — POST /users/invite/received/{id}
        if method == "POST" and path.startswith("/users/invite/received/"):
            invitation_id = path.split("/users/invite/received/")[1]
            account_id = (body or {}).get("account_id") or req.account_id or ""
            action = (body or {}).get("action", "accept")
            linkedin_token = (body or {}).get("linkedin_token")
            payload = {"account_id": account_id, "action": action}
            if linkedin_token:
                payload["linkedin_token"] = linkedin_token
            return await unipile_client._request(
                "POST",
                f"/users/invite/received/{invitation_id}",
                json=payload,
            )

        # All other endpoints — pass through as JSON
        if body is not None:
            kwargs["json"] = body

        result = await unipile_client._request(method, path, **kwargs)
        return result
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            status_code=e.response.status_code,
            content={"error": e.response.text[:500], "status": e.response.status_code},
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


class ProcessRequest(BaseModel):
    action_id: str


@app.post("/process")
async def process_endpoint(req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Called by Supabase Edge Functions to trigger a single action.
    Returns immediately (202) and runs the action in the background.
    
    Now includes:
    - Weekly rate limit tracking
    - Natural timing with jitter
    - Cross-campaign rate limiting
    - Auto-retry on rate limits
    """
    logger.info(f"Accepted process request for action_id: {req.action_id}")
    background_tasks.add_task(
        run_action_with_rate_limiting,
        req.action_id,
        semaphore,
        unipile_client
    )
    return {"status": "accepted", "action_id": req.action_id}


class EnrichLeadsRequest(BaseModel):
    workspace_id: str
    lead_ids: list[str]


@app.post("/api/enrich-leads")
async def enrich_leads_endpoint(req: EnrichLeadsRequest):
    """
    Enrich leads with profile data from LinkedIn via Unipile.
    Runs synchronously and returns after enrichment is complete.
    """
    logger.info(f"Starting enrichment for {len(req.lead_ids)} leads")
    await _enrich_leads_background(req.workspace_id, req.lead_ids)
    return {"status": "complete", "lead_count": len(req.lead_ids)}


async def _enrich_leads_background(workspace_id: str, lead_ids: list[str]):
    """Background task to enrich leads with profile data from Unipile."""
    try:
        supabase = get_supabase()
        
        # Get active LinkedIn account for this workspace
        accounts_response = supabase.table("linkedin_accounts").select(
            "id, unipile_account_id"
        ).eq("status", "active").limit(1).execute()
        
        accounts = accounts_response.data or []
        if not accounts:
            logger.warning(f"No active LinkedIn account found for workspace {workspace_id}")
            return
        
        unipile_account_id = accounts[0].get("unipile_account_id")
        if not unipile_account_id:
            logger.warning(f"LinkedIn account has no unipile_account_id")
            return
        
        # Fetch leads
        leads_response = supabase.table("leads").select(
            "id, profile_url, linkedin_member_id"
        ).in_("id", lead_ids).execute()
        
        leads = leads_response.data or []
        logger.info(f"Enriching {len(leads)} leads...")
        
        for lead in leads:
            try:
                # Extract identifier from profile URL
                profile_url = lead.get("profile_url", "")
                if not profile_url:
                    continue
                
                # Extract public identifier (e.g., "satyanadella" from "/in/satyanadella/")
                import re
                match = re.search(r'/in/([^/?]+)', profile_url)
                if not match:
                    logger.warning(f"Could not extract identifier from {profile_url}")
                    continue
                
                identifier = match.group(1).rstrip('/')
                
                # Fetch profile from Unipile
                logger.info(f"Fetching profile for {identifier}...")
                profile = await unipile_client.get_profile(unipile_account_id, identifier)
                
                logger.debug(f"Profile response keys: {list(profile.keys())}")
                
                # Extract provider_id - this is the correct Unipile member ID
                provider_id = (
                    profile.get("provider_id") or
                    profile.get("id") or
                    profile.get("member_id")
                )
                
                # Per Unipile API spec, LinkedIn profile returns first_name and last_name directly
                first_name = profile.get("first_name") or ""
                last_name = profile.get("last_name") or ""
                full_name = f"{first_name} {last_name}".strip() or None
                
                # Extract other fields
                headline = profile.get("headline")
                location = profile.get("location")
                
                # Extract current company from work_experience
                company = None
                work_experience = profile.get("work_experience", [])
                if work_experience:
                    current_jobs = [w for w in work_experience if w.get("current")]
                    if current_jobs:
                        company = current_jobs[0].get("company")
                    elif work_experience:
                        company = work_experience[0].get("company")
                
                # Build update data
                update_data = {}
                if provider_id:
                    update_data["linkedin_member_id"] = provider_id
                if full_name:
                    update_data["full_name"] = full_name
                if first_name:
                    update_data["first_name"] = first_name
                if last_name:
                    update_data["last_name"] = last_name
                if headline:
                    update_data["headline"] = headline
                if location:
                    update_data["location"] = location
                if company:
                    update_data["company"] = company
                
                if update_data:
                    supabase.table("leads").update(update_data).eq("id", lead["id"]).execute()
                    logger.info(f"Enriched lead: {full_name or identifier} (provider_id: {provider_id})")
                else:
                    logger.warning(f"No data to update for lead {identifier}, profile keys: {list(profile.keys())}")
                
        # Add delay to avoid rate limiting (3 seconds between leads)
                await asyncio.sleep(3)
                
            except Exception as e:
                logger.error(f"Failed to enrich lead {lead['id']}: {e}")
                continue
        
        logger.info(f"Enrichment complete for {len(leads)} leads")
        
    except Exception as e:
        logger.error(f"Enrichment background task failed: {e}")


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

                result = await _execute_action(action)

                # If the action was skipped due to unmet conditions, do not
                # increment daily counters and mark it as "skipped" status.
                if isinstance(result, dict) and result.get("skipped"):
                    supabase.table("action_queue").update({
                        "status": "skipped",
                        "executed_at": datetime.now(timezone.utc).isoformat(),
                        "result": result,
                    }).eq("id", action_id).execute()
                    logger.info(
                        f"Action {action_id} ({action['action_type']}) skipped "
                        f"(conditions not met) — counter not incremented."
                    )
                    success = True
                    continue

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

            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                body_text = e.response.text[:500]
                logger.error(f"Unipile HTTP {status} for action {action_id} ({action['action_type']}): {body_text}")
                if status in (401, 403):
                    raise SessionExpiredError(f"Unipile auth error {status}: {body_text}")
                if status == 404:
                    raise ProfileNotFoundError(f"Unipile resource not found: {e.request.url}")
                if status == 429:
                    raise Exception(f"Unipile rate limited (429) — will retry")
                raise Exception(f"Unipile API error {status}: {body_text}")

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
        limit = account.get("daily_connection_limit", 5)
        if used >= limit:
            raise AccountRestrictedError(
                f"Daily connection limit reached ({used}/{limit}) for account {account['id']}"
            )
    elif action_type == "message":
        used = account.get("today_messages", 0)
        limit = account.get("daily_message_limit", 5)
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


async def _check_conditions(action: dict, conditions: list[str]) -> str | None:
    """
    Evaluate runtime conditions for a campaign action step.

    Returns a skip reason string if any condition is NOT met, or None if all pass.

    Conditions:
      accepted       → lead's connection_status == 'connected'
      not_accepted   → lead's connection_status != 'connected'
      connected      → lead was already connected at enrollment (same as accepted)
      not_connected  → lead was not connected at enrollment
      replied        → lead has at least one inbound message in this campaign
      not_replied    → lead has no inbound messages in this campaign
    """
    if not conditions:
        return None

    lead_id = action.get("lead_id")
    campaign_id = action.get("campaign_id")

    if not lead_id:
        return None  # No lead context — can't evaluate, let it run

    supabase = get_supabase()

    # Fetch lead connection status (lazy — only if needed)
    lead_status: str | None = None
    has_replied: bool | None = None

    for condition in conditions:
        if condition in ("accepted", "not_accepted", "connected", "not_connected"):
            if lead_status is None:
                try:
                    resp = supabase.table("leads").select("connection_status").eq("id", lead_id).single().execute()
                    lead_status = (resp.data or {}).get("connection_status", "none")
                except Exception as e:
                    logger.warning(f"_check_conditions: could not fetch lead {lead_id}: {e}")
                    lead_status = "none"

            if condition == "accepted" and lead_status != "connected":
                return f"condition_failed:{condition} (status={lead_status})"
            if condition == "not_accepted" and lead_status == "connected":
                return f"condition_failed:{condition} (status={lead_status})"
            if condition == "connected" and lead_status != "connected":
                return f"condition_failed:{condition} (status={lead_status})"
            if condition == "not_connected" and lead_status == "connected":
                return f"condition_failed:{condition} (status={lead_status})"

        elif condition in ("replied", "not_replied"):
            if has_replied is None:
                try:
                    # Check for any inbound message from this lead in this campaign
                    resp = (
                        supabase.table("messages")
                        .select("id", count="exact")
                        .eq("lead_id", lead_id)
                        .eq("campaign_id", campaign_id)
                        .eq("direction", "inbound")
                        .limit(1)
                        .execute()
                    )
                    has_replied = (resp.count or 0) > 0
                except Exception as e:
                    logger.warning(f"_check_conditions: could not check replies for lead {lead_id}: {e}")
                    has_replied = False

            if condition == "replied" and not has_replied:
                return f"condition_failed:{condition}"
            if condition == "not_replied" and has_replied:
                return f"condition_failed:{condition}"

    return None  # All conditions passed


async def _execute_action(action: dict) -> dict:
    """Dispatch to the correct Unipile method based on action_type."""
    action_type = action["action_type"]
    payload = action.get("payload") or {}
    account = action["linkedin_accounts"]
    unipile_account_id = account.get("unipile_account_id")

    if not unipile_account_id:
        raise ValueError(f"Account {account['id']} has no unipile_account_id — cannot execute via Unipile")

    # Check runtime conditions stored in payload._conditions.
    # These are set by process-campaign when walking branching sequences.
    conditions = payload.get("_conditions", [])
    if conditions:
        skip_reason = await _check_conditions(action, conditions)
        if skip_reason:
            logger.info(
                f"Action {action['id']} ({action_type}) skipped — condition not met: {skip_reason}"
            )
            return {"skipped": True, "reason": skip_reason, "conditions": conditions}

    # Human-like random delay before every action (30–90 seconds)
    delay_secs = random.uniform(30, 90)
    logger.info(f"Waiting {delay_secs:.0f}s before executing {action_type}...")
    await asyncio.sleep(delay_secs)

    if action_type == "view_profile":
        # Support both new field name (identifier) and legacy (profile_url)
        identifier = payload.get("identifier") or _extract_identifier(payload.get("profile_url"))
        if not identifier:
            raise ValueError("view_profile action requires 'identifier' or 'profile_url' in payload")
        return await unipile_client.get_profile(unipile_account_id, identifier)

    if action_type == "connect":
        # Support both new field name (provider_id) and legacy (profile_url)
        provider_id = payload.get("provider_id")
        if not provider_id:
            # Fall back: fetch lead's linkedin_member_id from DB
            provider_id = await _resolve_provider_id(action)
        if not provider_id:
            raise ValueError("connect action requires 'provider_id' in payload or a lead with linkedin_member_id")
        return await unipile_client.send_invitation(
            unipile_account_id,
            provider_id,
            payload.get("message"),
        )

    if action_type == "message":
        # Support both new field name (attendee_id) and legacy (profile_url)
        attendee_id = payload.get("attendee_id")
        if not attendee_id:
            attendee_id = await _resolve_provider_id(action)
        if not attendee_id:
            raise ValueError("message action requires 'attendee_id' in payload or a lead with linkedin_member_id")
        if not payload.get("message"):
            raise ValueError("message action requires 'message' in payload")
        chat_id = await unipile_client.get_or_create_chat(unipile_account_id, attendee_id)
        return await unipile_client.send_message(chat_id, payload["message"], unipile_account_id)

    if action_type == "inmail":
        attendee_id = payload.get("attendee_id")
        if not attendee_id:
            attendee_id = await _resolve_provider_id(action)
        if not attendee_id:
            raise ValueError("inmail action requires 'attendee_id' in payload or a lead with linkedin_member_id")
        if not payload.get("message"):
            raise ValueError("inmail action requires 'message' in payload")
        return await unipile_client.send_inmail(
            unipile_account_id,
            attendee_id,
            payload["message"],
        )

    if action_type == "withdraw":
        # Find the pending invitation for this lead and cancel it.
        # Strategy: look up sent invitations and match by provider_id (lead's linkedin_member_id).
        provider_id = payload.get("provider_id")
        if not provider_id:
            provider_id = await _resolve_provider_id(action)
        if not provider_id:
            raise ValueError("withdraw action requires 'provider_id' in payload or a lead with linkedin_member_id")

        sent = await unipile_client.list_sent_invitations(unipile_account_id)
        invitation_id = None
        for inv in sent.get("items", []):
            # Unipile returns provider_id or recipient_id depending on API version
            if inv.get("provider_id") == provider_id or inv.get("recipient_id") == provider_id:
                invitation_id = inv.get("id")
                break

        if not invitation_id:
            logger.warning(
                f"withdraw: no pending invitation found for provider_id={provider_id} "
                f"on account {unipile_account_id} — skipping"
            )
            return {"skipped": True, "reason": "no_pending_invitation", "provider_id": provider_id}

        return await unipile_client.cancel_invitation(unipile_account_id, invitation_id)

    if action_type == "scrapeLeads":
        return await unipile_client.search(unipile_account_id, payload)

    raise ValueError(f"Unknown action_type: {action_type}")


def _extract_identifier(profile_url: str | None) -> str | None:
    """Extract LinkedIn public identifier from a profile URL."""
    if not profile_url:
        return None
    # e.g. https://www.linkedin.com/in/satyanadella/ → satyanadella
    parts = profile_url.rstrip("/").split("/in/")
    if len(parts) == 2:
        return parts[1].rstrip("/")
    return None


async def _resolve_provider_id(action: dict) -> str | None:
    """
    Fetch the lead's linkedin_member_id from the DB as a fallback
    when provider_id/attendee_id is not in the payload.
    """
    lead_id = action.get("lead_id")
    if not lead_id:
        return None
    try:
        supabase = get_supabase()
        resp = supabase.table("leads").select("linkedin_member_id").eq("id", lead_id).single().execute()
        return resp.data.get("linkedin_member_id") if resp.data else None
    except Exception as e:
        logger.warning(f"Could not resolve provider_id for lead {lead_id}: {e}")
        return None


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

