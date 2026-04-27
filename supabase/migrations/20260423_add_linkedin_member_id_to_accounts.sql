-- Add linkedin_member_id to linkedin_accounts so cookie-connected accounts
-- can be identified by their LinkedIn public ID and re-connected without
-- creating duplicate rows.
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS linkedin_member_id text;

-- Unique constraint so connect-cookie can do a safe lookup-then-insert
CREATE UNIQUE INDEX IF NOT EXISTS unique_workspace_member
  ON linkedin_accounts (workspace_id, linkedin_member_id)
  WHERE linkedin_member_id IS NOT NULL;
