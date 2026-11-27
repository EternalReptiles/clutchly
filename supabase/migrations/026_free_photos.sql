-- Photos are free: anyone can add photos to their own animals (was Pro only, migration 009).
drop policy if exists "own insert (pro)" on animal_photos;
drop policy if exists "own insert" on animal_photos;
create policy "own insert" on animal_photos for insert with check (user_id = auth.uid()
    and path like auth.uid()::text || '/%'
    and exists (select 1 from animals a where a.id = animal_id and a.user_id = auth.uid()));
drop policy if exists "animal-photos own folder insert" on storage.objects;
create policy "animal-photos own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
