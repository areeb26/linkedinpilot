"""
LinkedPilot Queue Worker

Continuously polls the action_queue for pending actions and processes them.
This worker is designed to run as a background service.

Features:
- Polls for pending actions every 10 seconds
- Processes actions with rate limiting
- Handles multiple workspaces
- Graceful shutdown on SIGINT/SIGTERM
"""
import asyncio
import signal
import sys
from datetime import datetime, timezone
from typing import Set

import pytz
from dotenv import load_dotenv

from utils.db import get_supabase
from utils.logger import logger
from utils.unipile import UnipileClient
from utils.action_runner import run_action_with_rate_limiting

load_dotenv()

# Configuration
POLL_INTERVAL = 10  # seconds between polls
MAX_CONCURRENT = 3  # max concurrent actions
BATCH_SIZE = 10  # max actions to fetch per poll
SYNC_INTERVAL = 60  # seconds between connection syncs (1 minute)

# Global state
running = True
semaphore: asyncio.Semaphore = None  # Initialized inside main() after event loop starts
unipile_client = UnipileClient()
processing_actions: Set[str] = set()  # Track actions currently being processed


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global running
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    running = False


async def fetch_pending_actions():
    """
    Fetch pending actions from the queue.
    
    Returns actions that are:
    - status = 'pending'
    - scheduled_at <= now (or null)
    - not currently being processed
    """
    supabase = get_supabase()
    
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        # Fetch pending actions that are due
        response = supabase.table("action_queue").select(
            "id, action_type, workspace_id, linkedin_account_id, scheduled_at, created_at"
        ).eq("status", "pending").or_(
            f"scheduled_at.is.null,scheduled_at.lte.{now}"
        ).order("created_at", desc=False).limit(BATCH_SIZE).execute()
        
        actions = response.data or []
        
        # Filter out actions already being processed
        actions = [a for a in actions if a["id"] not in processing_actions]
        
        return actions
    
    except Exception as e:
        # Check if it's a network error
        if any(msg in str(e) for msg in ["getaddrinfo failed", "Failed to resolve", "Name or service not known", "nodename nor servname provided"]):
            logger.warning(f"Network error fetching actions (DNS resolution failed). Will retry next poll.")
        else:
            logger.error(f"Error fetching pending actions: {e}")
        return []


async def process_action(action_id: str):
    """
    Process a single action.
    
    Wraps run_action_with_rate_limiting and handles cleanup.
    """
    try:
        processing_actions.add(action_id)
        logger.info(f"Processing action {action_id}")
        
        await run_action_with_rate_limiting(
            action_id,
            semaphore,
            unipile_client
        )
        
    except Exception as e:
        logger.error(f"Error processing action {action_id}: {e}")
    
    finally:
        processing_actions.discard(action_id)


async def sync_connections():
    """
    Sync connection status and messages from Unipile to local database.
    
    1. Fetches all connections from Unipile and updates leads with
       connection_status='connected' if they are in the connections list.
    2. Fetches recent chats and messages to detect replies.
    3. Updates campaign statuses when all leads are processed.
    """
    supabase = get_supabase()
    
    try:
        logger.info("Starting connection and message sync...")
        
        # Get all LinkedIn accounts
        response = supabase.table('linkedin_accounts').select('id, unipile_account_id, full_name').execute()
        
        if not response.data:
            logger.debug("No LinkedIn accounts found for sync")
            return
        
        accounts = response.data
        total_connections_updated = 0
        total_messages_synced = 0
        campaigns_completed = 0
        
        for account in accounts:
            account_id = account['id']
            unipile_account_id = account.get('unipile_account_id')
            account_name = account.get('full_name', 'Unknown')
            
            if not unipile_account_id:
                logger.debug(f"Account {account_name} has no unipile_account_id, skipping")
                continue
            
            # ===== SYNC CONNECTIONS =====
            # Fetch all connections from Unipile
            all_connections = []
            cursor = None
            
            while True:
                try:
                    result = await unipile_client.get_relations(unipile_account_id, cursor=cursor)
                    connections = result.get('items', [])
                    all_connections.extend(connections)
                    
                    cursor = result.get('cursor')
                    if not cursor:
                        break
                        
                except Exception as e:
                    logger.error(f"Error fetching connections for {account_name}: {e}")
                    break
            
            if all_connections:
                # Extract member IDs from connections
                connected_provider_ids = set()
                for conn in all_connections:
                    provider_id = conn.get('provider_id') or conn.get('member_id') or conn.get('id')
                    if provider_id:
                        connected_provider_ids.add(provider_id)
                
                if connected_provider_ids:
                    # Get all leads with linkedin_member_id
                    leads_response = supabase.table('leads').select('id, linkedin_member_id, full_name, connection_status').execute()
                    
                    if leads_response.data:
                        leads = leads_response.data
                        
                        # Update leads that are in the connections list
                        for lead in leads:
                            linkedin_member_id = lead.get('linkedin_member_id')
                            current_status = lead.get('connection_status')
                            lead_id = lead.get('id')
                            
                            if linkedin_member_id and linkedin_member_id in connected_provider_ids:
                                if current_status != 'connected':
                                    try:
                                        # Update lead connection status
                                        supabase.table('leads').update({
                                            'connection_status': 'connected'
                                        }).eq('id', lead_id).execute()
                                        
                                        # Also update campaign enrollment status to 'connected'
                                        supabase.table('campaign_enrollments').update({
                                            'status': 'connected'
                                        }).eq('lead_id', lead_id).execute()
                                        
                                        logger.info(f"Updated {lead.get('full_name', 'Unknown')} to 'connected' (lead and enrollment)")
                                        total_connections_updated += 1
                                    except Exception as e:
                                        logger.error(f"Failed to update lead {lead_id}: {e}")
            
            # ===== SYNC MESSAGES =====
            # Fetch recent chats to detect new replies
            try:
                chats_result = await unipile_client.list_chats(unipile_account_id, limit=50)
                chats = chats_result.get('items', [])
                
                for chat in chats:
                    chat_id = chat.get('id')
                    if not chat_id:
                        continue
                    
                    # Get messages from this chat
                    try:
                        messages_result = await unipile_client.list_messages(chat_id)
                        messages = messages_result.get('items', [])
                        
                        for msg in messages:
                            msg_id = msg.get('id')
                            text = msg.get('text', '')
                            created_at = msg.get('created_at') or msg.get('timestamp')
                            sender_id = msg.get('sender_id') or msg.get('provider_id')
                            is_sender = msg.get('is_sender')  # 1 if we sent it, 0 if they sent it
                            is_event = msg.get('is_event', 0)  # Filter out reactions
                            
                            if not msg_id or not text:
                                continue
                            
                            # Skip reaction events
                            if is_event == 1 or is_event is True:
                                continue
                            
                            # Determine direction
                            # Unipile API returns is_sender as number: 1 = we sent it, 0 = they sent it
                            # is_sender=1 means we sent it (outbound)
                            # is_sender=0 means they sent it (inbound)
                            direction = 'outbound' if (is_sender == 1 or is_sender is True) else 'inbound'
                            
                            # Only sync inbound messages (replies) for campaign tracking
                            if direction == 'outbound':
                                continue  # Skip our own messages
                            
                            # For inbound messages, try to find the lead by sender_id
                            if sender_id:
                                lead_response = supabase.table('leads').select('id, workspace_id').eq('linkedin_member_id', sender_id).execute()
                                
                                if not lead_response.data:
                                    continue  # Can't match to a lead
                                
                                lead = lead_response.data[0]
                                lead_id = lead['id']
                                workspace_id = lead['workspace_id']
                                
                                # Try to find campaign enrollment
                                enrollment_response = supabase.table('campaign_enrollments').select('campaign_id').eq('lead_id', lead_id).execute()
                                
                                campaign_id = None
                                if enrollment_response.data:
                                    campaign_id = enrollment_response.data[0].get('campaign_id')
                                    
                                    # Check if message already exists (avoid duplicates)
                                    existing_msg = supabase.table('messages').select('id').eq('lead_id', lead_id).eq('body', text).eq('direction', direction).execute()
                                    
                                    if existing_msg.data:
                                        continue  # Message already synced
                                    
                                    # Insert message
                                    try:
                                        supabase.table('messages').insert({
                                            'workspace_id': workspace_id,
                                            'linkedin_account_id': account_id,
                                            'lead_id': lead_id,
                                            'campaign_id': campaign_id,
                                            'direction': direction,
                                            'body': text,
                                        }).execute()
                                        
                                        logger.info(f"Synced message from lead {lead_id}")
                                        total_messages_synced += 1
                                        
                                        # Update enrollment status to 'replied' if this is an inbound message
                                        if direction == 'inbound' and campaign_id:
                                            try:
                                                supabase.table('campaign_enrollments').update({
                                                    'status': 'replied'
                                                }).eq('lead_id', lead_id).eq('campaign_id', campaign_id).execute()
                                                logger.info(f"Updated enrollment status to 'replied' for lead {lead_id}")
                                            except Exception as update_error:
                                                logger.warning(f"Failed to update enrollment status: {update_error}")
                                        
                                    except Exception as e:
                                        logger.error(f"Failed to insert message: {e}")
                        
                    except Exception as e:
                        logger.debug(f"Error fetching messages for chat {chat_id}: {e}")
                
            except Exception as e:
                logger.error(f"Error fetching chats for {account_name}: {e}")
        
        # ===== UPDATE CAMPAIGN STATUSES =====
        # Check for campaigns that should be marked as completed or paused (end date passed)
        try:
            # Get all active campaigns
            campaigns_response = supabase.table('campaigns').select('id, name, workspace_id, settings, timezone').eq('status', 'active').execute()
            
            if campaigns_response.data:
                for campaign in campaigns_response.data:
                    campaign_id = campaign['id']
                    campaign_name = campaign['name']
                    workspace_id = campaign['workspace_id']
                    settings = campaign.get('settings', {})
                    campaign_timezone = campaign.get('timezone', 'UTC')
                    
                    # ===== CHECK END DATE =====
                    # If campaign has an end date and it has passed, pause the campaign
                    schedule_settings = settings.get('schedule', {}) if isinstance(settings, dict) else {}
                    end_date_str = schedule_settings.get('endDate')
                    
                    if end_date_str:
                        try:
                            # Parse end date (format: YYYY-MM-DD)
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                            
                            # Get current date in campaign's timezone
                            tz = pytz.timezone(campaign_timezone)
                            current_date = datetime.now(tz).date()
                            
                            # If end date has passed, pause the campaign
                            if current_date > end_date:
                                try:
                                    supabase.table('campaigns').update({
                                        'status': 'paused',
                                    }).eq('id', campaign_id).execute()
                                    
                                    logger.info(f"Campaign '{campaign_name}' auto-paused (end date {end_date_str} passed)")
                                    campaigns_completed += 1
                                    continue  # Skip to next campaign, don't check completion
                                    
                                except Exception as e:
                                    logger.error(f"Failed to pause campaign {campaign_id} (end date passed): {e}")
                        
                        except Exception as e:
                            logger.warning(f"Failed to parse end date for campaign {campaign_id}: {e}")
                    
                    # Get enrollments for this campaign
                    enrollments_response = supabase.table('campaign_enrollments').select('id, lead_id, status').eq('campaign_id', campaign_id).eq('workspace_id', workspace_id).execute()
                    
                    if not enrollments_response.data:
                        continue  # No enrollments, skip
                    
                    enrollments = enrollments_response.data
                    enrolled_count = len(enrollments)
                    
                    # Check if all enrollments are in a terminal state
                    # Terminal states: connected, replied, completed, failed, unsubscribed, bounced, error
                    terminal_states = ['connected', 'replied', 'completed', 'failed', 'unsubscribed', 'bounced', 'error']
                    terminal_count = len([e for e in enrollments if e['status'] in terminal_states])
                    
                    # Also check for pending actions
                    lead_ids = [e['lead_id'] for e in enrollments]
                    pending_actions_response = supabase.table('action_queue').select('id').eq('workspace_id', workspace_id).in_('lead_id', lead_ids).eq('status', 'pending').execute()
                    pending_actions_count = len(pending_actions_response.data) if pending_actions_response.data else 0
                    
                    # Campaign is complete if:
                    # 1. All enrollments are in terminal states AND no pending actions, OR
                    # 2. At least 80% of enrollments are in terminal states AND no pending actions
                    completion_threshold = enrolled_count * 0.8
                    
                    should_complete = False
                    completion_reason = ""
                    
                    if terminal_count >= enrolled_count and pending_actions_count == 0:
                        should_complete = True
                        completion_reason = f"all {enrolled_count} leads processed"
                    elif terminal_count >= completion_threshold and pending_actions_count == 0:
                        should_complete = True
                        completion_reason = f"{terminal_count}/{enrolled_count} leads processed (80% threshold)"
                    
                    if should_complete:
                        try:
                            supabase.table('campaigns').update({
                                'status': 'completed',
                                'completed_at': datetime.now(timezone.utc).isoformat()
                            }).eq('id', campaign_id).execute()
                            
                            logger.info(f"Campaign '{campaign_name}' marked as completed ({completion_reason})")
                            campaigns_completed += 1
                            
                        except Exception as e:
                            logger.error(f"Failed to update campaign {campaign_id} status: {e}")
        
        except Exception as e:
            logger.error(f"Error updating campaign statuses: {e}")
        
        if total_connections_updated > 0 or total_messages_synced > 0 or campaigns_completed > 0:
            logger.info(f"Sync complete: {total_connections_updated} connection(s), {total_messages_synced} message(s), {campaigns_completed} campaign(s) completed")
        else:
            logger.debug("Sync complete: no updates needed")
            
    except Exception as e:
        # Check if it's a network/DNS error
        if any(msg in str(e) for msg in ["getaddrinfo failed", "Failed to resolve", "Name or service not known", "nodename nor servname provided", "Connection"]):
            logger.warning(f"Network error in connection sync (will retry next cycle): {e}")
        else:
            logger.error(f"Error in connection sync: {e}")


async def sync_loop():
    """
    Periodic connection and message sync loop.
    
    Runs every SYNC_INTERVAL seconds to sync connection statuses and messages.
    """
    try:
        logger.info(f"Connection and message sync enabled: running every {SYNC_INTERVAL // 60} minutes")
        logger.info(f"Sync loop starting, running={running}")
        
        # Run initial sync after 30 seconds (interruptible)
        elapsed = 0
        while running and elapsed < 30:
            await asyncio.sleep(1)
            elapsed += 1
        
        # Check if we're still running after initial delay
        if not running:
            logger.info(f"Sync loop stopped during initial delay (running={running})")
            return
        
        logger.info("Starting main sync loop")
        while running:
            try:
                await sync_connections()
            except Exception as e:
                logger.error(f"Error in sync loop: {e}", exc_info=True)
            
            if not running:
                break

            # Sleep in small increments so shutdown signal is noticed promptly
            elapsed = 0
            while running and elapsed < SYNC_INTERVAL:
                await asyncio.sleep(min(10, SYNC_INTERVAL - elapsed))
                elapsed += 10
        
        logger.info(f"Sync loop stopped (running={running})")
    except Exception as e:
        logger.error(f"Fatal error in sync loop: {e}", exc_info=True)
        raise


async def worker_loop():
    """
    Main worker loop.
    
    Continuously polls for pending actions and processes them.
    """
    logger.info("Worker started. Polling for pending actions...")
    logger.info(f"Poll interval: {POLL_INTERVAL}s, Max concurrent: {MAX_CONCURRENT}")
    
    while running:
        try:
            # Fetch pending actions
            actions = await fetch_pending_actions()
            
            if actions:
                logger.info(f"Found {len(actions)} pending action(s)")
                
                # Process each action concurrently (fire-and-forget with error logging)
                for action in actions:
                    task = asyncio.create_task(process_action(action["id"]))
                    def _on_done(t):
                        if not t.cancelled():
                            exc = t.exception()
                            if exc:
                                logger.error(f"Action task failed: {exc}")
                    task.add_done_callback(_on_done)
                
            else:
                logger.debug("No pending actions found")
            
            # Wait before next poll
            await asyncio.sleep(POLL_INTERVAL)
        
        except Exception as e:
            logger.error(f"Error in worker loop: {e}", exc_info=True)
            await asyncio.sleep(POLL_INTERVAL)
    
    logger.info(f"Worker loop stopped (running={running})")


async def main():
    """
    Main entry point.
    
    Sets up signal handlers and starts the worker loop and sync loop.
    """
    global semaphore, running

    # Reset running flag — it may have been set to False by a signal during
    # module import or startup on Windows (concurrently sends Ctrl+C on startup)
    running = True
    logger.debug(f"Main starting, running flag set to: {running}")

    # Create semaphore inside the running event loop (required for Python 3.10+)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    # Register signal handlers for graceful shutdown.
    # Use asyncio-safe handlers where supported (Unix only).
    # On Windows, loop.add_signal_handler is not implemented, and signal.signal(SIGINT)
    # can fire spuriously when spawned by concurrently/npm, killing the worker immediately.
    # Instead we rely on KeyboardInterrupt (caught in __main__) for Windows shutdown.
    loop = asyncio.get_running_loop()
    try:
        loop.add_signal_handler(signal.SIGINT, lambda: signal_handler(signal.SIGINT, None))
        loop.add_signal_handler(signal.SIGTERM, lambda: signal_handler(signal.SIGTERM, None))
    except (NotImplementedError, AttributeError):
        # Windows: skip signal.signal registration to avoid spurious SIGINT from npm/concurrently.
        # Graceful shutdown is handled via KeyboardInterrupt in __main__.
        pass
    
    logger.info("=" * 60)
    logger.info("LinkedPilot Queue Worker")
    logger.info("=" * 60)
    
    try:
        logger.info("Starting worker loop and sync loop...")
        # Run worker loop and sync loop concurrently.
        # return_exceptions=True prevents one loop's exception from cancelling the other.
        results = await asyncio.gather(
            worker_loop(),
            sync_loop(),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Loop exited with error: {result}", exc_info=result)
    except Exception as e:
        logger.error(f"Fatal error in worker: {e}")
        sys.exit(1)
    
    logger.info("Worker shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        running = False
        logger.info("Worker interrupted by user")
        sys.exit(0)
