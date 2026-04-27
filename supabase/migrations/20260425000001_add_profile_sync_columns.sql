-- Add columns needed for Unipile profile sync
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS linkedin_handle TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
