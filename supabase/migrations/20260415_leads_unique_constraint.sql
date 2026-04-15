-- ============================================================
-- Add unique constraint on (workspace_id, profile_url) for leads table
-- This is required for upsert operations to work properly
-- ============================================================

-- First, clean up any duplicate leads that might exist
-- Keep the most recently updated lead for each workspace_id + profile_url combination
DELETE FROM leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY workspace_id, profile_url ORDER BY updated_at DESC, created_at DESC) as rn
    FROM leads
    WHERE profile_url IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'leads_workspace_profile_url_unique'
  ) THEN
    CREATE UNIQUE INDEX leads_workspace_profile_url_unique ON leads(workspace_id, profile_url);
  END IF;
END $$;

-- Also ensure campaign_enrollments has its unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'campaign_enrollments_campaign_lead_unique'
  ) THEN
    CREATE UNIQUE INDEX campaign_enrollments_campaign_lead_unique ON campaign_enrollments(campaign_id, lead_id);
  END IF;
END $$;
