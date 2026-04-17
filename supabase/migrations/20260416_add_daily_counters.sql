-- Add daily activity counters to linkedin_accounts
-- today_connections / today_messages reset daily via connections_reset_at

alter table linkedin_accounts
  add column if not exists today_connections    int not null default 0,
  add column if not exists today_messages       int not null default 0,
  add column if not exists connections_reset_at timestamptz not null default now();

-- Atomic increment functions (avoids read-modify-write race on concurrent actions)
create or replace function increment_today_connections(account_id uuid)
returns void language sql security definer as $$
  update linkedin_accounts
  set today_connections = today_connections + 1
  where id = account_id;
$$;

create or replace function increment_today_messages(account_id uuid)
returns void language sql security definer as $$
  update linkedin_accounts
  set today_messages = today_messages + 1
  where id = account_id;
$$;
