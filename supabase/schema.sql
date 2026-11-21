-- Run in Supabase SQL editor. Every row belongs to one user; RLS enforces it.
create table animals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, species text not null default 'Carpet', sex text not null default 'Female',
  status text not null default 'Active', dob date, feed_every int, notes text,
  created_at timestamptz default now());
create table events(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  animal_id uuid not null references animals on delete cascade,
  kind text not null check (kind in ('feed','shed','weight')),
  on_date date not null default current_date,
  ok boolean, food text, grams numeric, note text);
create index on events(animal_id, kind, on_date desc);
create table pairings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  female_id uuid not null references animals on delete cascade,
  male_id uuid not null references animals on delete cascade,
  intro date default current_date, removed date, ovulation date, prelay_shed date,
  laid date, hatched date, clutch int, fertile int,
  locks date[] not null default '{}', notes text);
create table season_settings(
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  species text not null, pause_from text, pause_to text, pair_start text,
  primary key(user_id, species));

alter table animals enable row level security;
alter table events enable row level security;
alter table pairings enable row level security;
alter table season_settings enable row level security;
create policy own on animals for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own on season_settings for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy own on events for all using (user_id=auth.uid())
  with check (user_id=auth.uid() and exists(select 1 from animals a where a.id=animal_id and a.user_id=auth.uid()));
create policy own on pairings for all using (user_id=auth.uid())
  with check (user_id=auth.uid()
    and exists(select 1 from animals a where a.id=female_id and a.user_id=auth.uid())
    and exists(select 1 from animals a where a.id=male_id and a.user_id=auth.uid()));

create view animal_status with (security_invoker=true) as
select a.*,
 (select max(on_date) from events e where e.animal_id=a.id and kind='feed') last_feed,
 (select max(on_date) from events e where e.animal_id=a.id and kind='shed') last_shed,
 (select grams from events e where e.animal_id=a.id and kind='weight' order by on_date desc limit 1) last_weight
from animals a;

-- App Store requires in-app account deletion.
create function delete_my_account() returns void language sql security definer set search_path=public as
$$ delete from auth.users where id = auth.uid() $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
