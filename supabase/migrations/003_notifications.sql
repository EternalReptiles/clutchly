-- Push notifications: device tokens and per-user notification settings.

-- One row per device. A token belongs to one user at a time: if a phone signs in to another account,
-- register_device_token moves it, so nobody gets another user's notifications.
create table if not exists device_tokens(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
alter table device_tokens enable row level security;
drop policy if exists own on device_tokens;
create policy own on device_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Users can see and remove their own tokens; adding goes through register_device_token.
grant select, delete on device_tokens to authenticated;

create or replace function register_device_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then raise exception 'not an Expo push token'; end if;
  insert into device_tokens(user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function register_device_token(text, text) from public, anon;
grant execute on function register_device_token(text, text) to authenticated;

-- What to send and when, in the user's own timezone. last_sent_on is set by the daily-digest Edge Function.
create table if not exists notification_settings(
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  feed_due boolean not null default true,      -- "6 animals due to feed today"
  lay_soon boolean not null default true,      -- estimated lay (or birth) in 7 days
  pairing_soon boolean not null default true,  -- a species' pairing start in 3 days
  notify_hour int not null default 7 check (notify_hour between 0 and 23),
  timezone text not null default 'UTC',        -- the app sets the phone's timezone
  last_sent_on date,
  updated_at timestamptz not null default now());
alter table notification_settings enable row level security;
drop policy if exists own on notification_settings;
create policy own on notification_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on notification_settings to authenticated;
