-- Incubation log: readings for a clutch (a pairing with eggs laid): temperature, humidity, how many eggs are still
-- good, and a note. Plus the incubator's name and target temperature on the pairing, so readings away from the target
-- stand out. Syncs offline like everything else. Safe to run again.

alter table pairings add column if not exists incubator text;
alter table pairings add column if not exists target_temp numeric(4,1);

create table if not exists incubation_logs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pairing_id uuid not null references pairings on delete cascade,
  on_date date not null default current_date,
  temp numeric(4,1) check (temp between 0 and 60),              -- °C
  humidity numeric(4,1) check (humidity between 0 and 100),    -- %
  eggs_good int check (eggs_good >= 0),
  note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), synced_at timestamptz not null default now());
alter table incubation_logs enable row level security;
drop policy if exists own on incubation_logs;
create policy own on incubation_logs for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and clutchly_owns_pairing(pairing_id));
revoke all on incubation_logs from anon;
grant select, insert, update, delete on incubation_logs to authenticated;
create index if not exists incubation_logs_sync_idx on incubation_logs (user_id, synced_at);
create index if not exists incubation_logs_pairing_idx on incubation_logs (pairing_id);

-- Offline sync (migration 005): last-write-wins and deletion records.
drop trigger if exists touch on incubation_logs;
create trigger touch before insert or update on incubation_logs for each row execute function clutchly_touch();
drop trigger if exists record_delete on incubation_logs;
create trigger record_delete after delete on incubation_logs for each row execute function clutchly_record_delete();
