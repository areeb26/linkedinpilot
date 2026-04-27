"""
Enrich leads with linkedin_member_id from Unipile.

This script fetches leads that have profile_url but no linkedin_member_id,
looks them up via Unipile API, and updates the database.

This is required for the worker to send connection requests.
"""
import asyncio
import re
from dotenv import load_dotenv

from utils.db import get_supabase
from utils.unipile import UnipileClient
from utils.logger import logger

load_dotenv()


def extract_public_identifier(profile_url: str) -> str | None:
    """
    Extract LinkedIn public identifier from profile URL.
    
    Examples:
    - https://www.linkedin.com/in/satyanadella/ → satyanadella
    - https://www.linkedin.com/in/satyanadella/overlay/contact-info/ → satyanadella
    """
    if not profile_url:
        return None
    
    # Match /in/{identifier}/ or /in/{identifier}
    match = re.search(r'/in/([^/]+)', profile_url)
    if match:
        return match.group(1)
    
    return None


async def enrich_lead(unipile_client: UnipileClient, account_id: str, lead: dict) -> dict | None:
    """
    Enrich a single lead with linkedin_member_id from Unipile.
    
    Returns updated lead data or None if failed.
    """
    profile_url = lead.get("profile_url")
    if not profile_url:
        logger.warning(f"Lead {lead['id']} has no profile_url")
        return None
    
    identifier = extract_public_identifier(profile_url)
    if not identifier:
        logger.warning(f"Could not extract identifier from {profile_url}")
        return None
    
    try:
        # Fetch profile from Unipile
        logger.info(f"Fetching profile for {identifier}...")
        profile = await unipile_client.get_profile(account_id, identifier)
        
        # Extract provider_id (LinkedIn member ID)
        provider_id = profile.get("provider_id")
        if not provider_id:
            logger.warning(f"No provider_id in Unipile response for {identifier}")
            return None
        
        logger.info(f"✅ Found provider_id for {lead.get('full_name', identifier)}: {provider_id}")
        
        return {
            "id": lead["id"],
            "linkedin_member_id": provider_id,
            "full_name": profile.get("name") or lead.get("full_name"),
            "headline": profile.get("headline") or lead.get("headline"),
        }
    
    except Exception as e:
        logger.error(f"Failed to enrich lead {lead['id']}: {e}")
        return None


async def main():
    """Main enrichment process."""
    logger.info("=" * 60)
    logger.info("Lead Enrichment Script")
    logger.info("=" * 60)
    
    supabase = get_supabase()
    unipile_client = UnipileClient()
    
    # Get active LinkedIn account
    logger.info("Fetching LinkedIn account...")
    accounts_response = supabase.table("linkedin_accounts").select(
        "id, full_name, unipile_account_id, status"
    ).eq("status", "active").limit(1).execute()
    
    accounts = accounts_response.data or []
    if not accounts:
        logger.error("No active LinkedIn account found")
        return
    
    account = accounts[0]
    unipile_account_id = account.get("unipile_account_id")
    
    if not unipile_account_id:
        logger.error(f"Account {account['full_name']} has no unipile_account_id")
        return
    
    logger.info(f"Using account: {account['full_name']}")
    
    # Fetch leads without linkedin_member_id
    logger.info("Fetching leads without linkedin_member_id...")
    leads_response = supabase.table("leads").select(
        "id, profile_url, full_name, headline, linkedin_member_id"
    ).is_("linkedin_member_id", "null").not_.is_("profile_url", "null").limit(50).execute()
    
    leads = leads_response.data or []
    
    if not leads:
        logger.info("✅ All leads already have linkedin_member_id")
        return
    
    logger.info(f"Found {len(leads)} leads to enrich")
    
    # Filter out invalid profile URLs
    valid_leads = []
    for lead in leads:
        profile_url = lead.get("profile_url", "")
        # Skip overlay URLs and other invalid patterns
        if "/overlay/" in profile_url or "/contact-info/" in profile_url:
            logger.warning(f"Skipping invalid URL: {profile_url}")
            continue
        if not extract_public_identifier(profile_url):
            logger.warning(f"Skipping unparseable URL: {profile_url}")
            continue
        valid_leads.append(lead)
    
    logger.info(f"Processing {len(valid_leads)} valid leads...")
    
    # Enrich leads one by one (with delay to avoid rate limits)
    enriched = []
    for i, lead in enumerate(valid_leads, 1):
        logger.info(f"[{i}/{len(valid_leads)}] Processing {lead.get('full_name', 'Unknown')}...")
        
        result = await enrich_lead(unipile_client, unipile_account_id, lead)
        if result:
            enriched.append(result)
        
        # Add delay between requests to avoid rate limiting
        if i < len(valid_leads):
            await asyncio.sleep(2)
    
    # Update database
    if enriched:
        logger.info(f"Updating {len(enriched)} leads in database...")
        
        for lead_data in enriched:
            try:
                supabase.table("leads").update({
                    "linkedin_member_id": lead_data["linkedin_member_id"],
                    "full_name": lead_data["full_name"],
                    "headline": lead_data["headline"],
                }).eq("id", lead_data["id"]).execute()
                
                logger.info(f"✅ Updated {lead_data['full_name']}")
            
            except Exception as e:
                logger.error(f"Failed to update lead {lead_data['id']}: {e}")
        
        logger.info(f"✅ Successfully enriched {len(enriched)} leads")
    else:
        logger.warning("No leads were enriched")
    
    logger.info("=" * 60)
    logger.info("Enrichment complete")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
