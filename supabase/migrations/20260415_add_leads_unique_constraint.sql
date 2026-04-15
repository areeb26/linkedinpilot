-- Add unique constraint on workspace_id + profile_url for lead deduplication
-- This allows upsert operations from the save-leads Edge Function

-- First, handle any existing duplicates
WITH duplicates AS (
  SELECT id, workspace_id, profile_url,
         ROW_NUMBER() OVER (PARTITION BY workspace_id, profile_url ORDER BY created_at DESC) as rn
  FROM leads
  WHERE profile_url IS NOT NULL
)
UPDATE leads
SET profile_url = profile_url || '?dup=' || id
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Add the unique constraint
ALTER TABLE leads
ADD CONSTRAINT unique_workspace_profile UNIQUE (workspace_id, profile_url);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_workspace_profile ON leads(workspace_id, profile_url);
