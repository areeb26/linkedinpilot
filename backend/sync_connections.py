"""
Sync connection status from Unipile to local database.

This script fetches all connections from Unipile and updates the connection_status
of leads in the database to 'connected' if they are found in the connections list.
"""
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client
from utils.unipile import UnipileClient
from utils.logger import logger

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)


async def sync_connections_for_account(unipile_client: UnipileClient, account_id: str, unipile_account_id: str):
    """Sync connections and messages for a single LinkedIn account."""
    logger.info(f"Syncing connections and messages for account {account_id}...")
    
    connections_updated = 0
    messages_synced = 0
    
    # ===== SYNC CONNECTIONS =====
    # Fetch all connections from Unipile
    all_connections = []
    cursor = None
    
    while True:
        try:
            result = await unipile_client.get_relations(unipile_account_id, cursor=cursor)
            connections = result.get('items', [])
            all_connections.extend(connections)
            
            logger.info(f"  Fetched {len(connections)} connections (total: {len(all_connections)})")
            
            # Check if there are more pages
            cursor = result.get('cursor')
            if not cursor:
                break
                
        except Exception as e:
            logger.error(f"  Error fetching connections: {e}")
            break
    
    if not all_connections:
        logger.info(f"  No connections found")
    else:
        # Extract provider IDs from connections
        connected_provider_ids = set()
        for conn in all_connections:
            # Try multiple possible ID fields
            provider_id = conn.get('provider_id') or conn.get('member_id') or conn.get('id')
            if provider_id:
                connected_provider_ids.add(provider_id)
        
        logger.info(f"  Found {len(connected_provider_ids)} unique connections")
        
        # Get all leads with pending connection status
        response = supabase.table('leads').select('id, linkedin_member_id, full_name, connection_status').execute()
        
        if not response.data:
            logger.info(f"  No leads found in database")
        else:
            leads = response.data
            
            # Update leads that are in the connections list
            for lead in leads:
                linkedin_member_id = lead.get('linkedin_member_id')
                current_status = lead.get('connection_status')
                
                if linkedin_member_id and linkedin_member_id in connected_provider_ids:
                    # This lead is connected
                    if current_status != 'connected':
                        try:
                            supabase.table('leads').update({
                                'connection_status': 'connected'
                            }).eq('id', lead['id']).execute()
                            
                            logger.info(f"  ✓ Updated {lead.get('full_name', 'Unknown')} to 'connected'")
                            connections_updated += 1
                        except Exception as e:
                            logger.error(f"  ✗ Failed to update lead {lead['id']}: {e}")
    
    # ===== SYNC MESSAGES =====
    logger.info(f"  Syncing messages...")
    try:
        chats_result = await unipile_client.list_chats(unipile_account_id, limit=50)
        chats = chats_result.get('items', [])
        
        logger.info(f"  Found {len(chats)} recent chats")
        
        for i, chat in enumerate(chats, 1):
            chat_id = chat.get('id')
            if not chat_id:
                continue
            
            logger.debug(f"  Processing chat {i}/{len(chats)}: {chat_id}")
            
            # Get messages from this chat
            try:
                messages_result = await unipile_client.list_messages(chat_id)
                messages = messages_result.get('items', [])
                
                logger.info(f"  Chat {i}: {len(messages)} messages")
                
                for msg in messages:
                    msg_id = msg.get('id')
                    text = msg.get('text', '')
                    created_at = msg.get('created_at') or msg.get('timestamp')
                    sender_id = msg.get('sender_id') or msg.get('provider_id')
                    is_sender = msg.get('is_sender', False)  # True if we sent it
                    
                    logger.info(f"    Msg: is_sender={is_sender}, has_text={bool(text)}, sender={sender_id[:20] if sender_id else None}")
                    
                    if not msg_id or not text:
                        logger.info(f"    Skipping: no msg_id or text")
                        continue
                    
                    # Check if message already exists (by content + lead + direction)
                    # Since unipile_message_id column doesn't exist, we check by content
                    direction = 'outbound' if is_sender else 'inbound'
                    
                    # Only sync inbound messages (replies)
                    if direction == 'outbound':
                        continue  # Skip outbound messages
                    
                    logger.info(f"    Inbound message from sender: {sender_id[:20] if sender_id else 'unknown'}")
                    
                    # For inbound messages, try to find the lead by sender_id
                    if sender_id:
                        logger.info(f"  Looking for lead with linkedin_member_id: {sender_id}")
                        lead_response = supabase.table('leads').select('id, workspace_id, full_name').eq('linkedin_member_id', sender_id).execute()
                        
                        if not lead_response.data:
                            logger.warning(f"  ✗ No lead found for sender_id: {sender_id}")
                            continue  # Can't match to a lead
                        
                        lead = lead_response.data[0]
                        lead_id = lead['id']
                        workspace_id = lead['workspace_id']
                        
                        logger.info(f"  ✓ Found lead: {lead.get('full_name')} ({lead_id})")
                        
                        # Try to find campaign enrollment
                        enrollment_response = supabase.table('campaign_enrollments').select('campaign_id').eq('lead_id', lead_id).execute()
                        
                        campaign_id = None
                        if enrollment_response.data:
                            campaign_id = enrollment_response.data[0].get('campaign_id')
                            logger.info(f"  Campaign: {campaign_id}")
                        
                        # Insert message
                        try:
                            supabase.table('messages').insert({
                                'workspace_id': workspace_id,
                                'linkedin_account_id': account_id,
                                'lead_id': lead_id,
                                'campaign_id': campaign_id,
                                'direction': direction,
                                'body': text,  # Column is 'body', not 'content'
                            }).execute()
                            
                            logger.info(f"  ✓ Synced message from lead {lead_id}")
                            messages_synced += 1
                        except Exception as e:
                            logger.error(f"  Failed to insert message: {e}")
                
            except Exception as e:
                logger.debug(f"  Error fetching messages for chat {chat_id}: {e}")
        
    except Exception as e:
        logger.error(f"  Error fetching chats: {e}")
    
    return connections_updated, messages_synced


async def main():
    """Main sync function."""
    logger.info("=" * 60)
    logger.info("Connection and Message Sync")
    logger.info("=" * 60)
    
    # Get all LinkedIn accounts
    response = supabase.table('linkedin_accounts').select('id, unipile_account_id, full_name').execute()
    
    if not response.data:
        logger.info("No LinkedIn accounts found")
        return
    
    accounts = response.data
    logger.info(f"Found {len(accounts)} LinkedIn account(s)")
    
    unipile_client = UnipileClient()
    total_connections_updated = 0
    total_messages_synced = 0
    
    for account in accounts:
        account_id = account['id']
        unipile_account_id = account.get('unipile_account_id')
        account_name = account.get('full_name', 'Unknown')
        
        if not unipile_account_id:
            logger.warning(f"Account {account_name} has no unipile_account_id, skipping")
            continue
        
        logger.info(f"\n{account_name} ({account_id})")
        connections_updated, messages_synced = await sync_connections_for_account(unipile_client, account_id, unipile_account_id)
        total_connections_updated += connections_updated
        total_messages_synced += messages_synced
    
    logger.info("\n" + "=" * 60)
    logger.info(f"Sync complete!")
    logger.info(f"  Connections updated: {total_connections_updated}")
    logger.info(f"  Messages synced: {total_messages_synced}")
    logger.info("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
