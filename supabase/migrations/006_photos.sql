-- Animal photos: a private Storage bucket, one folder per user, and a table listing each animal's photos.
-- File path: <user id>/<animal id>/<photo id>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animal-photos', 'animal-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Each user can only read, add, change or delete files inside the folder named after their own user id.
drop policy if exists "animal-photos own folder read" on storage.objects;
drop policy if exists "animal-photos own folder insert" on storage.objects;
drop policy if exists "animal-photos own folder update" on storage.objects;
drop policy if exists "animal-photos own folder delete" on storage.objects;
create policy "animal-photos own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "animal-photos own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "animal-photos own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "animal-photos own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists animal_photos(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  animal_id uuid not null references animals on delete cascade,
  path text not null unique,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now());
create index if not exists animal_photos_animal_idx on animal_photos (animal_id);
create index if not exists animal_photos_sync_idx on animal_photos (user_id, synced_at);
alter table animal_photos enable row level security;
drop policy if exists own on animal_photos;
create policy own on animal_photos for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and path like auth.uid()::text || '/%'
    and exists (select 1 from animals a where a.id = animal_id and a.user_id = auth.uid()));
grant select, insert, update, delete on animal_photos to authenticated;
grant select on animal_photos to service_role;

-- Offline sync, same as the other tables (migration 005).
drop trigger if exists touch on animal_photos;
create trigger touch before insert or update on animal_photos for each row execute function clutchly_touch();
drop trigger if exists record_delete on animal_photos;
create trigger record_delete after delete on animal_photos for each row execute function clutchly_record_delete();

-- Files to remove from Storage. Filled whenever a photo row is deleted for any reason (the photo itself, its animal,
-- or the whole account), and emptied by the hourly daily-digest Edge Function, which has the rights to delete files.
-- Not visible to users.
create table if not exists photo_cleanup(path text primary key, queued_at timestamptz not null default now());
alter table photo_cleanup enable row level security;
grant select, delete on photo_cleanup to service_role;
create or replace function clutchly_queue_photo_cleanup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into photo_cleanup(path) values (old.path) on conflict do nothing;
  return old;
end $$;
drop trigger if exists queue_cleanup on animal_photos;
create trigger queue_cleanup after delete on animal_photos for each row execute function clutchly_queue_photo_cleanup();
