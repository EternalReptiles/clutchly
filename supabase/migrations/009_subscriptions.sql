-- Subscriptions: who has Pro, written ONLY by the revenuecat-webhook Edge Function (service role).
-- The app can read its own row but can never write it, so a modified app cannot make itself Pro.

-- Plan limits as data, not code. Change a value here (new migration) or in the dashboard.
create table if not exists app_limits(key text primary key, value int not null, note text);
alter table app_limits enable row level security;
drop policy if exists "signed-in users can read" on app_limits;
create policy "signed-in users can read" on app_limits for select to authenticated using (true);
revoke all on app_limits from anon, authenticated; grant select on app_limits to authenticated;
insert into app_limits (key, value, note) values ('free_animals', 10, 'Animals a free account can have (all statuses, including Sold and hatchlings).')
on conflict (key) do nothing;

create table if not exists subscriptions(
  user_id uuid primary key references auth.users on delete cascade,
  entitlement text not null default 'pro',
  active boolean not null default false,
  expires_at timestamptz,           -- null with active = lifetime / no expiry
  product_id text, store text, environment text,
  last_event_type text,
  last_event_at timestamptz,        -- RevenueCat event time; older events are ignored
  updated_at timestamptz not null default now());
alter table subscriptions enable row level security;
drop policy if exists "read own" on subscriptions;
create policy "read own" on subscriptions for select to authenticated using (user_id = auth.uid());
revoke all on subscriptions from anon, authenticated;
grant select on subscriptions to authenticated;
grant select, insert, update, delete on subscriptions to service_role;

-- Pro right now? (security definer so policies and triggers can use it without exposing other users' rows)
create or replace function is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() = uid)   -- signed-in users can only ask about themselves
     and exists (select 1 from subscriptions s where s.user_id = uid and s.entitlement = 'pro' and s.active
                 and (s.expires_at is null or s.expires_at > now())) $$;
revoke all on function is_pro(uuid) from public, anon;
grant execute on function is_pro(uuid) to authenticated, service_role;

-- Free limit, enforced in the database. Existing animals are never touched; only adding beyond the limit is refused.
create or replace function enforce_free_animal_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  if is_pro(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('animal-limit:' || new.user_id::text)); -- two phones adding at once can't both slip past
  select value into lim from app_limits where key = 'free_animals';
  select count(*) into n from animals where user_id = new.user_id;
  if lim is not null and n >= lim then
    raise exception 'free_limit_reached: free accounts can have up to % animals', lim using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists free_animal_limit on animals;
create trigger free_animal_limit before insert on animals for each row execute function enforce_free_animal_limit();

-- Photos are a Pro feature: adding needs Pro; viewing and deleting existing photos always work.
drop policy if exists own on animal_photos;
create policy own on animal_photos for select using (user_id = auth.uid());
drop policy if exists "own insert (pro)" on animal_photos;
create policy "own insert (pro)" on animal_photos for insert with check (user_id = auth.uid() and is_pro(auth.uid())
    and path like auth.uid()::text || '/%'
    and exists (select 1 from animals a where a.id = animal_id and a.user_id = auth.uid()));
drop policy if exists "own update" on animal_photos;
create policy "own update" on animal_photos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own delete" on animal_photos;
create policy "own delete" on animal_photos for delete using (user_id = auth.uid());
drop policy if exists "animal-photos own folder insert" on storage.objects;
create policy "animal-photos own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and is_pro((select auth.uid())));
