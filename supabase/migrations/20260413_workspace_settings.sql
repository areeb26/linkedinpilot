-- Add workspace_settings table
create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade unique,
  timezone text not null default 'UTC',
  
  -- Integrations
  gemini_api_key_enc text,
  hunter_api_key_enc text,
  webhook_url text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for workspace_settings
alter table workspace_settings enable row level security;

create policy "workspace_select" on workspace_settings
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on workspace_settings
  for all using (workspace_id in (select auth_user_workspace_ids()));

-- Add Trigger for updated_at
create trigger trg_workspace_settings_updated_at
  before update on workspace_settings
  for each row execute function set_updated_at();

-- Add invitation table for team management
create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid not null, -- auth.uid()
  token text not null unique default encode(gen_random_bytes(24), 'base64url'),
  status text not null default 'pending', -- pending | accepted | expired
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- RLS for team_invitations
alter table team_invitations enable row level security;

create policy "workspace_select" on team_invitations
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on team_invitations
  for all using (workspace_id in (select auth_user_workspace_ids()));
