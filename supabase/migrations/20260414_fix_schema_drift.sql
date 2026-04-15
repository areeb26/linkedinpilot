-- ============================================================
-- Migration: Fix Schema Drift
-- Adds missing columns and tables referenced in RLS/policies
-- ============================================================

-- Add missing daily counter columns to linkedin_accounts
-- These are referenced in rls.sql for the pg_cron reset job
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS daily_connections_sent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_messages_sent int NOT NULL DEFAULT 0;

-- Create workspace_settings table (referenced in useWorkspace.js but missing)
CREATE TABLE IF NOT EXISTS workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- General settings
  timezone text NOT NULL DEFAULT 'UTC',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  -- Email/Notification settings
  email_notifications boolean NOT NULL DEFAULT true,
  daily_digest_enabled boolean NOT NULL DEFAULT true,
  -- AI settings
  ai_tone text NOT NULL DEFAULT 'professional', -- professional | casual | friendly | formal
  ai_auto_suggest boolean NOT NULL DEFAULT true,
  -- Safety/Throttle settings
  max_daily_connections_per_account int NOT NULL DEFAULT 20,
  max_daily_messages_per_account int NOT NULL DEFAULT 50,
  warmup_mode boolean NOT NULL DEFAULT true,
  -- Webhook settings
  webhook_url text,
  webhook_secret text,
  -- Branding
  logo_url text,
  brand_color text DEFAULT '#7c3aed',
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

-- Enable RLS on workspace_settings
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace_settings
DROP POLICY IF EXISTS workspace_settings_select ON workspace_settings;
DROP POLICY IF EXISTS workspace_settings_mutate ON workspace_settings;

CREATE POLICY workspace_settings_select
  ON workspace_settings
  FOR SELECT
  USING (workspace_id = any(auth_workspace_ids()));

CREATE POLICY workspace_settings_mutate
  ON workspace_settings
  FOR ALL
  USING      (workspace_id = any(auth_workspace_ids()))
  WITH CHECK (workspace_id = any(auth_workspace_ids()));

-- Create trigger to auto-create workspace_settings when workspace is created
CREATE OR REPLACE FUNCTION create_workspace_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_settings (workspace_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_settings_trigger ON workspaces;
CREATE TRIGGER workspace_settings_trigger
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION create_workspace_settings();

-- Backfill existing workspaces that don't have settings
INSERT INTO workspace_settings (workspace_id)
SELECT id FROM workspaces
WHERE id NOT IN (SELECT workspace_id FROM workspace_settings);

-- Add trigger for updated_at on workspace_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspace_settings_updated_at ON workspace_settings;
CREATE TRIGGER update_workspace_settings_updated_at
  BEFORE UPDATE ON workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
