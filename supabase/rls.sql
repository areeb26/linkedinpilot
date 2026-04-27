-- ============================================================
-- LinkedPilot — Row Level Security
-- Run after schema.sql. Safe to re-run (idempotent).
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";      -- daily reset job

-- ============================================================
-- HELPER: auth_workspace_ids()
-- Returns uuid[] of every workspace the calling user may access:
--   • workspaces they own  (workspaces.owner_id = auth.uid())
--   • workspaces they are a member of  (team_members.user_id = auth.uid())
-- Returns an array so policies can use  workspace_id = any(auth_workspace_ids())
-- which is index-friendly and avoids a subquery per row.
-- security definer + search_path lock prevents privilege escalation.
-- ============================================================

create or replace function auth_workspace_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array(
    select id
    from   workspaces
    where  owner_id = auth.uid()

    union

    select workspace_id
    from   team_members
    where  user_id     = auth.uid()
      and  accepted_at is not null   -- ignore unaccepted invitations
  )
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- alter table ... enable row level security is idempotent.
-- ============================================================

alter table workspaces           enable row level security;
alter table team_members         enable row level security;
alter table linkedin_accounts    enable row level security;
alter table leads                enable row level security;
alter table campaigns            enable row level security;
alter table campaign_enrollments enable row level security;
alter table action_queue         enable row level security;
alter table actions_log          enable row level security;
alter table messages             enable row level security;
alter table opportunities        enable row level security;
alter table posts                enable row level security;
alter table automations          enable row level security;
alter table shared_reports       enable row level security;

-- ============================================================
-- IDEMPOTENT POLICY CLEANUP
-- Drop every policy we are about to (re)create so this file
-- can be applied multiple times without "policy already exists".
-- ============================================================

do $drop$ declare
  _tbl text;
  _pol text;
begin
  for _tbl, _pol in
    values
      ('workspaces',           'workspaces_select'),
      ('workspaces',           'workspaces_insert'),
      ('workspaces',           'workspaces_update'),
      ('workspaces',           'workspaces_delete'),
      ('team_members',         'team_members_select'),
      ('team_members',         'team_members_insert'),
      ('team_members',         'team_members_update'),
      ('team_members',         'team_members_delete'),
      ('linkedin_accounts',    'linkedin_accounts_all'),
      ('leads',                'leads_all'),
      ('campaigns',            'campaigns_all'),
      ('campaign_enrollments', 'campaign_enrollments_all'),
      ('action_queue',         'action_queue_all'),
      ('actions_log',          'actions_log_select'),
      ('actions_log',          'actions_log_insert'),
      ('messages',             'messages_all'),
      ('opportunities',        'opportunities_all'),
      ('posts',                'posts_all'),
      ('automations',          'automations_all'),
      ('shared_reports',       'shared_reports_select'),
      ('shared_reports',       'shared_reports_public_select'),
      ('shared_reports',       'shared_reports_mutate')
  loop
    execute format('drop policy if exists %I on %I', _pol, _tbl);
  end loop;
end $drop$;

-- ============================================================
-- WORKSPACES — owner-only write, members can read
-- ============================================================

-- Any workspace member (owner or accepted team member) may read.
create policy workspaces_select
  on workspaces
  for select
  using (id = any(auth_workspace_ids()));

-- Only the owner may create a workspace (owner_id must equal their uid).
create policy workspaces_insert
  on workspaces
  for insert
  with check (owner_id = auth.uid());

-- Only the owner may update workspace settings.
create policy workspaces_update
  on workspaces
  for update
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Only the owner may delete the workspace.
create policy workspaces_delete
  on workspaces
  for delete
  using (owner_id = auth.uid());

-- ============================================================
-- TEAM MEMBERS
-- Members can see their own workspace's roster.
-- Only workspace owners/admins should invite — enforced in Edge Functions.
-- ============================================================

create policy team_members_select
  on team_members
  for select
  using (workspace_id = any(auth_workspace_ids()));

-- Allow insert so the invite flow can add a row; Edge Function checks role.
create policy team_members_insert
  on team_members
  for insert
  with check (workspace_id = any(auth_workspace_ids()));

-- Allow the invited user to accept their own invite (set accepted_at).
-- Also allows admins to change roles within their workspace.
create policy team_members_update
  on team_members
  for update
  using  (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

-- Removal: only workspace members may remove rows in their workspace.
create policy team_members_delete
  on team_members
  for delete
  using (workspace_id = any(auth_workspace_ids()));

-- ============================================================
-- STANDARD WORKSPACE-SCOPED TABLES
-- Full CRUD for any authenticated member of the workspace.
-- ============================================================

create policy linkedin_accounts_all
  on linkedin_accounts
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy leads_all
  on leads
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy campaigns_all
  on campaigns
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy campaign_enrollments_all
  on campaign_enrollments
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy action_queue_all
  on action_queue
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy messages_all
  on messages
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy opportunities_all
  on opportunities
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy posts_all
  on posts
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

create policy automations_all
  on automations
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

-- ============================================================
-- ACTIONS LOG — append-only audit trail
-- Members can read; only INSERT allowed (no UPDATE / DELETE).
-- ============================================================

create policy actions_log_select
  on actions_log
  for select
  using (workspace_id = any(auth_workspace_ids()));

create policy actions_log_insert
  on actions_log
  for insert
  with check (workspace_id = any(auth_workspace_ids()));

-- ============================================================
-- SHARED REPORTS
-- Members can manage their own workspace's reports.
-- Anonymous users can read a report if it has a valid public token
-- and has not expired — no auth.uid() check.
-- ============================================================

-- Authenticated workspace members: full access.
create policy shared_reports_select
  on shared_reports
  for select
  using (workspace_id = any(auth_workspace_ids()));

-- Public read via token — auth.uid() may be null here.
create policy shared_reports_public_select
  on shared_reports
  for select
  using (
    is_active = true
    and (expires_at is null or expires_at > now())
    -- public_token match is enforced by the query predicate in the app,
    -- not in the policy, so any live report is row-visible once the
    -- client supplies ?public_token=... in the query filter.
  );

-- Mutations restricted to workspace members.
create policy shared_reports_mutate
  on shared_reports
  for all
  using      (workspace_id = any(auth_workspace_ids()))
  with check (workspace_id = any(auth_workspace_ids()));

-- ============================================================
-- PG_CRON — nightly daily-send counter reset
--
-- linkedin_accounts tracks two rolling daily counters:
--   today_connections  int not null default 0
--   today_messages     int not null default 0
-- The cron job fires at 00:00 UTC every day and resets both counters
-- so the per-account daily throttle window starts fresh.
-- ============================================================

-- Remove any prior version of this job before (re)scheduling.
select cron.unschedule('reset_daily_send_counts')
where  exists (
  select 1 from cron.job where jobname = 'reset_daily_send_counts'
);

select cron.schedule(
  'reset_daily_send_counts',          -- job name (unique)
  '0 0 * * *',                        -- cron expression: midnight UTC daily
  $$
    update linkedin_accounts
    set
      today_connections = 0,
      today_messages    = 0,
      updated_at        = now()
    where
      today_connections > 0
      or today_messages > 0;          -- skip no-op rows to reduce WAL churn
  $$
);
