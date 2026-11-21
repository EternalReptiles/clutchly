-- Offline sync support.
-- updated_at: when the row was last edited, set by the device that edited it (possibly while offline).
-- synced_at:  when the server last received a change to the row; devices pull rows with synced_at after their last sync.
-- Conflict rule (last write wins): an update whose updated_at is older than the stored row's is ignored, so an edit
-- made earlier but synced later never overwrites a newer one.

do $$ declare t text; begin
  foreach t in array array['animals', 'events', 'pairings', 'season_settings'] loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table %I add column if not exists synced_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on %I (user_id, synced_at)', t || '_sync_idx', t);
    -- created_at: the app sorts by it (animals already had one).
    if t in ('events', 'pairings') then execute format('alter table %I add column if not exists created_at timestamptz not null default now()', t); end if;
  end loop;
end $$;

create or replace function clutchly_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;  -- stale edit: keep the newer row
  end if;
  if new.updated_at is null then new.updated_at := now(); end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

-- Deletions, so other devices can remove rows deleted elsewhere. Cascades (e.g. an animal's events) are recorded too.
create table if not exists deleted_rows(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  table_name text not null,
  row_key text not null,          -- the row's id (season_settings: its species)
  deleted_at timestamptz not null default clock_timestamp());
create index if not exists deleted_rows_sync_idx on deleted_rows (user_id, deleted_at);
alter table deleted_rows enable row level security;
drop policy if exists own on deleted_rows;
create policy own on deleted_rows for select using (user_id = auth.uid());
grant select on deleted_rows to authenticated;
grant select on deleted_rows to service_role;

create or replace function clutchly_record_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Rows removed because the whole account is being deleted need no record (and the account row is already gone).
  if not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
  insert into deleted_rows(user_id, table_name, row_key)
  values (old.user_id, tg_table_name, to_jsonb(old) ->> (case when tg_table_name = 'season_settings' then 'species' else 'id' end));
  return old;
end $$;

do $$ declare t text; begin
  foreach t in array array['animals', 'events', 'pairings', 'season_settings'] loop
    execute format('drop trigger if exists touch on %I', t);
    execute format('create trigger touch before insert or update on %I for each row execute function clutchly_touch()', t);
    execute format('drop trigger if exists record_delete on %I', t);
    execute format('create trigger record_delete after delete on %I for each row execute function clutchly_record_delete()', t);
  end loop;
end $$;
