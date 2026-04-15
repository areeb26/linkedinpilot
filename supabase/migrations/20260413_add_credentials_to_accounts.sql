-- Add credential storage columns to linkedin_accounts
alter table linkedin_accounts 
add column if not exists li_email_enc text,
add column if not exists li_password_enc text,
add column if not exists login_method text check (login_method in ('credentials', 'extension', 'cookies')) default 'extension',
add column if not exists health_status text default 'healthy', -- healthy, restricted, blocked
add column if not exists daily_send_count int default 0,
add column if not exists login_error_message text;

-- Create an index for faster lookups during worker execution
create index if not exists idx_linkedin_accounts_health on linkedin_accounts(health_status);
