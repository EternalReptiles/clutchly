-- Messages sent from the app's Contact support form (Account > Help, or the sign-in screen). Written only by the
-- support-message Edge Function (service role), which also emails them to the support address. Nobody can read or
-- write them from the app; read them in the Supabase dashboard (Table Editor > support_messages). Safe to run again.

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users on delete set null,   -- null when sent signed out
  email text not null,                                     -- where to reply
  topic text not null,
  message text not null check (length(message) between 1 and 5000),
  meta jsonb not null default '{}',                        -- app version, platform, plan: what support needs to know
  client_hash text,                                        -- hashed IP, only for limiting how often one sender can write
  emailed boolean not null default false,
  status text not null default 'new' check (status in ('new', 'replied', 'closed'))
);
create index if not exists support_messages_recent on support_messages (created_at desc);
create index if not exists support_messages_sender on support_messages (client_hash, created_at);
alter table support_messages enable row level security;   -- no policies: no access from the app
revoke all on support_messages from anon, authenticated;
grant select, insert, update, delete on support_messages to service_role;
