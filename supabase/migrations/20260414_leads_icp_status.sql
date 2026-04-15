-- Add icp_score and status columns to leads table
-- icp_score: 0-100 integer for ICP fit scoring
-- status: outreach lifecycle (new | contacted | replied | bounced)

alter table leads
  add column if not exists icp_score integer check (icp_score >= 0 and icp_score <= 100),
  add column if not exists status text not null default 'new'
    check (status in ('new', 'contacted', 'replied', 'bounced'));

-- Index for common filter patterns
create index if not exists leads_icp_score_idx on leads (workspace_id, icp_score);
create index if not exists leads_status_idx on leads (workspace_id, status);

-- Add icp_config to workspace_settings (stores ICP scoring criteria as JSONB)
alter table workspace_settings
  add column if not exists icp_config jsonb not null default '{}';
