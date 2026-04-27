-- Migration: Add unipile_account_id to linkedin_accounts
-- This links local LinkedIn account records to Unipile's account registry.
-- Column is nullable so existing rows are unaffected.

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_unipile_id
  ON linkedin_accounts (unipile_account_id);
