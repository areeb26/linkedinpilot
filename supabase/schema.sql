-- ============================================================
-- LinkedPilot — Supabase Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES
-- Root tenant/org table. All other tables FK to this.
-- ============================================================
create table if not exists workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  owner_id      uuid not null,               -- references auth.users(id)
  plan          text not null default 'free', -- free | starter | pro | agency
  stripe_customer_id text,
  stripe_subscription_id text,
  seats         int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TEAM MEMBERS
-- Users belonging to a workspace (many-to-one).
-- ============================================================
create table if not exists team_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null,               -- references auth.users(id)
  role          text not null default 'member', -- owner | admin | member | viewer
  invited_by    uuid,                         -- references auth.users(id)
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- ============================================================
-- LINKEDIN ACCOUNTS
-- Connected LinkedIn seats for outreach.
-- ============================================================
create table if not exists linkedin_accounts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  user_id             uuid,                   -- team member who owns this seat
  linkedin_member_id  text,                   -- LinkedIn internal member URN
  full_name           text not null,
  headline            text,
  profile_url         text,
  avatar_url          text,
  email               text,
  status              text not null default 'pending', -- pending | active | warming | paused | disconnected | error
  daily_connection_limit  int not null default 20,
  daily_message_limit     int not null default 50,
  warmup_enabled      boolean not null default false,
  proxy_id            uuid,
  login_method        text not null default 'extension', -- extension | cookies | credentials
  li_email_enc        text,                   -- encrypted email for worker login
  li_password_enc     text,                   -- encrypted password for worker login
  cookie_encrypted    text,                   -- encrypted LinkedIn session cookie
  last_activity_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- LEADS
-- Prospect/contact records.
-- ============================================================
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  linkedin_member_id  text,                   -- LinkedIn URN
  first_name          text,
  last_name           text,
  full_name           text,
  headline            text,
  company             text,
  company_url         text,
  title               text,
  location            text,
  profile_url         text,
  avatar_url          text,
  email               text,
  phone               text,
  website             text,
  industry            text,
  employee_count      text,
  revenue_range       text,
  tags                text[] default '{}',
  custom_fields       jsonb not null default '{}',
  connection_status   text not null default 'none', -- none | pending | connected | ignored
  connected_at        timestamptz,
  source              text,                   -- manual | csv | lead-extractor | api
  is_archived         boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Unique constraint for upsert operations (workspace_id + profile_url)
create unique index if not exists leads_workspace_profile_url_unique on leads(workspace_id, profile_url);

-- ============================================================
-- CAMPAIGNS
-- Outreach sequences targeting a set of leads.
-- ============================================================
create table if not exists campaigns (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  name                text not null,
  description         text,
  status              text not null default 'draft', -- draft | active | paused | completed | archived
  type                text not null default 'outreach', -- outreach | nurture | event | follow-up
  sequence_json       jsonb not null default '[]',  -- React Flow nodes/edges
  settings            jsonb not null default '{}',  -- schedule, timezone, throttle, etc.
  daily_limit         int not null default 20,
  timezone            text not null default 'UTC',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_by          uuid,                   -- references auth.users(id)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- CAMPAIGN ENROLLMENTS
-- Junction: which leads are enrolled in which campaigns.
-- ============================================================
create table if not exists campaign_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  campaign_id         uuid not null references campaigns(id) on delete cascade,
  lead_id             uuid not null references leads(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  status              text not null default 'active', -- active | paused | completed | replied | unsubscribed | bounced | error
  current_step        int not null default 0,
  next_action_at      timestamptz,
  enrolled_at         timestamptz not null default now(),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

-- ============================================================
-- ACTION QUEUE
-- Pending outreach actions to be executed by the Chrome extension.
-- ============================================================
create table if not exists action_queue (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  campaign_id           uuid references campaigns(id) on delete cascade,
  campaign_enrollment_id uuid references campaign_enrollments(id) on delete cascade,
  lead_id               uuid references leads(id) on delete cascade,
  linkedin_account_id   uuid references linkedin_accounts(id) on delete cascade,
  action_type           text not null, -- connect | message | view_profile | like_post | follow | inmail | email
  payload               jsonb not null default '{}', -- message body, template vars, etc.
  status                text not null default 'pending', -- pending | processing | done | failed | skipped | cancelled
  priority              int not null default 5,
  scheduled_at          timestamptz not null default now(),
  started_at            timestamptz,
  executed_at           timestamptz,
  error_message         text,
  retry_count           int not null default 0,
  max_retries           int not null default 3,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- ACTIONS LOG
-- Immutable audit trail of all executed actions.
-- ============================================================
create table if not exists actions_log (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  action_queue_id       uuid references action_queue(id) on delete set null,
  campaign_id           uuid references campaigns(id) on delete set null,
  lead_id               uuid references leads(id) on delete set null,
  linkedin_account_id   uuid references linkedin_accounts(id) on delete set null,
  action_type           text not null,
  status                text not null, -- done | failed | skipped
  payload               jsonb not null default '{}',
  result                jsonb not null default '{}',  -- response data from LinkedIn
  error_message         text,
  executed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

-- ============================================================
-- MESSAGES
-- All LinkedIn conversations (Unibox).
-- ============================================================
create table if not exists messages (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  lead_id             uuid references leads(id) on delete set null,
  campaign_id         uuid references campaigns(id) on delete set null,
  thread_id           text,                   -- LinkedIn conversation URN
  direction           text not null,          -- inbound | outbound
  body                text not null,
  body_html           text,
  subject             text,
  is_read             boolean not null default false,
  is_ai_suggested     boolean not null default false,
  ai_suggestion       text,
  sentiment           text,                   -- positive | neutral | negative | interested | not_interested
  tags                text[] default '{}',
  linkedin_message_id text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- OPPORTUNITIES
-- CRM-light: leads that have shown buying intent.
-- ============================================================
create table if not exists opportunities (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  lead_id             uuid not null references leads(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  name                text not null,
  stage               text not null default 'new', -- new | contacted | qualified | demo | proposal | won | lost
  value               numeric(12, 2),
  currency            text not null default 'USD',
  probability         int,                    -- 0-100
  expected_close_date date,
  owner_id            uuid,                   -- references auth.users(id)
  notes               text,
  tags                text[] default '{}',
  custom_fields       jsonb not null default '{}',
  won_at              timestamptz,
  lost_at             timestamptz,
  lost_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- POSTS
-- Content Assistant — scheduled or published LinkedIn posts.
-- ============================================================
create table if not exists posts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  author_id           uuid,                   -- references auth.users(id)
  body                text not null,
  media_urls          text[] default '{}',
  post_type           text not null default 'text', -- text | image | video | article | carousel | poll
  status              text not null default 'draft', -- draft | scheduled | published | failed | archived
  ai_generated        boolean not null default false,
  ai_prompt           text,
  linkedin_post_id    text,
  scheduled_at        timestamptz,
  published_at        timestamptz,
  impressions         int,
  reactions           int,
  comments            int,
  reposts             int,
  clicks              int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- AUTOMATIONS
-- Inbound trigger-based automations (e.g. auto-reply on comment).
-- ============================================================
create table if not exists automations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid references linkedin_accounts(id) on delete set null,
  name                text not null,
  description         text,
  status              text not null default 'inactive', -- inactive | active | paused | error
  trigger_type        text not null, -- new_connection | profile_view | post_comment | post_reaction | keyword_mention | inmail_received | form_submit
  trigger_config      jsonb not null default '{}',
  action_type         text not null, -- send_message | add_to_campaign | add_tag | notify_team | webhook
  action_config       jsonb not null default '{}',
  conditions          jsonb not null default '[]', -- filter rules
  run_count           int not null default 0,
  last_triggered_at   timestamptz,
  created_by          uuid,                   -- references auth.users(id)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- SHARED REPORTS
-- Shareable analytics snapshots with public token.
-- ============================================================
create table if not exists shared_reports (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete cascade,
  created_by          uuid,                   -- references auth.users(id)
  name                text not null,
  description         text,
  report_type         text not null default 'campaign', -- campaign | account | workspace
  snapshot_data       jsonb not null default '{}',   -- denormalized metrics at time of share
  public_token        text not null unique default encode(gen_random_bytes(24), 'base64url'),
  password_hash       text,                   -- optional password protection
  expires_at          timestamptz,
  view_count          int not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- linkedin_accounts
create index if not exists idx_linkedin_accounts_workspace on linkedin_accounts(workspace_id);
create index if not exists idx_linkedin_accounts_status on linkedin_accounts(workspace_id, status);

-- leads
create index if not exists idx_leads_workspace on leads(workspace_id);
create index if not exists idx_leads_connection_status on leads(workspace_id, connection_status);
create index if not exists idx_leads_linkedin_member on leads(linkedin_member_id) where linkedin_member_id is not null;

-- campaigns
create index if not exists idx_campaigns_workspace on campaigns(workspace_id);
create index if not exists idx_campaigns_status on campaigns(workspace_id, status);

-- campaign_enrollments
create index if not exists idx_enrollments_workspace on campaign_enrollments(workspace_id);
create index if not exists idx_enrollments_campaign on campaign_enrollments(campaign_id);
create index if not exists idx_enrollments_lead on campaign_enrollments(lead_id);
create index if not exists idx_enrollments_next_action on campaign_enrollments(next_action_at) where status = 'active';

-- action_queue
create index if not exists idx_action_queue_workspace on action_queue(workspace_id);
create index if not exists idx_action_queue_pending on action_queue(linkedin_account_id, scheduled_at) where status = 'pending';
create index if not exists idx_action_queue_status on action_queue(workspace_id, status);

-- actions_log
create index if not exists idx_actions_log_workspace on actions_log(workspace_id);
create index if not exists idx_actions_log_campaign on actions_log(campaign_id);
create index if not exists idx_actions_log_lead on actions_log(lead_id);
create index if not exists idx_actions_log_executed_at on actions_log(workspace_id, executed_at desc);

-- messages
create index if not exists idx_messages_workspace on messages(workspace_id);
create index if not exists idx_messages_lead on messages(lead_id);
create index if not exists idx_messages_thread on messages(thread_id) where thread_id is not null;
create index if not exists idx_messages_unread on messages(workspace_id, linkedin_account_id) where is_read = false;

-- opportunities
create index if not exists idx_opportunities_workspace on opportunities(workspace_id);
create index if not exists idx_opportunities_lead on opportunities(lead_id);
create index if not exists idx_opportunities_stage on opportunities(workspace_id, stage);

-- posts
create index if not exists idx_posts_workspace on posts(workspace_id);
create index if not exists idx_posts_status on posts(workspace_id, status);
create index if not exists idx_posts_scheduled on posts(scheduled_at) where status = 'scheduled';

-- automations
create index if not exists idx_automations_workspace on automations(workspace_id);
create index if not exists idx_automations_active on automations(workspace_id) where status = 'active';

-- shared_reports
create index if not exists idx_shared_reports_workspace on shared_reports(workspace_id);
create index if not exists idx_shared_reports_token on shared_reports(public_token);

-- team_members
create index if not exists idx_team_members_workspace on team_members(workspace_id);
create index if not exists idx_team_members_user on team_members(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table workspaces             enable row level security;
alter table team_members           enable row level security;
alter table linkedin_accounts      enable row level security;
alter table leads                  enable row level security;
alter table campaigns              enable row level security;
alter table campaign_enrollments   enable row level security;
alter table action_queue           enable row level security;
alter table actions_log            enable row level security;
alter table messages               enable row level security;
alter table opportunities          enable row level security;
alter table posts                  enable row level security;
alter table automations            enable row level security;
alter table shared_reports         enable row level security;

-- Helper: return the workspace_ids the current user belongs to
create or replace function auth_user_workspace_ids()
returns setof uuid
language sql stable security definer as $$
  select workspace_id from team_members where user_id = auth.uid()
$$;

-- Workspaces: members can read their own workspace
create policy "workspace_select" on workspaces
  for select using (id in (select auth_user_workspace_ids()));

-- Generic workspace-scoped SELECT policy factory (applied per table below)
create policy "workspace_select" on team_members
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on linkedin_accounts
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on leads
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on campaigns
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on campaign_enrollments
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on action_queue
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on actions_log
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on messages
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on opportunities
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on posts
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on automations
  for select using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_select" on shared_reports
  for select using (
    workspace_id in (select auth_user_workspace_ids())
    or (is_active = true and (expires_at is null or expires_at > now()))
  );

-- INSERT / UPDATE / DELETE: members can mutate rows in their workspace
create policy "workspace_mutate" on linkedin_accounts
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on leads
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on campaigns
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on campaign_enrollments
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on action_queue
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on messages
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on opportunities
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on posts
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on automations
  for all using (workspace_id in (select auth_user_workspace_ids()));

create policy "workspace_mutate" on shared_reports
  for all using (workspace_id in (select auth_user_workspace_ids()));

-- actions_log is append-only — no update/delete for regular users
create policy "workspace_insert" on actions_log
  for insert with check (workspace_id in (select auth_user_workspace_ids()));

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_workspaces_updated_at
  before update on workspaces
  for each row execute function set_updated_at();

create trigger trg_linkedin_accounts_updated_at
  before update on linkedin_accounts
  for each row execute function set_updated_at();

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

create trigger trg_campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

create trigger trg_campaign_enrollments_updated_at
  before update on campaign_enrollments
  for each row execute function set_updated_at();

create trigger trg_action_queue_updated_at
  before update on action_queue
  for each row execute function set_updated_at();

create trigger trg_messages_updated_at
  before update on messages
  for each row execute function set_updated_at();

create trigger trg_opportunities_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

create trigger trg_posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

create trigger trg_automations_updated_at
  before update on automations
  for each row execute function set_updated_at();

create trigger trg_shared_reports_updated_at
  before update on shared_reports
  for each row execute function set_updated_at();
