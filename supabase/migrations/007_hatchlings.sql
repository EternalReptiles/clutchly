-- Hatchlings: link animals to their parents and to the pairing they came from.
alter table animals add column if not exists mother_id uuid references animals(id) on delete set null;
alter table animals add column if not exists father_id uuid references animals(id) on delete set null;
alter table animals add column if not exists pairing_id uuid references pairings(id) on delete set null;
create index if not exists animals_mother_idx on animals (mother_id);
create index if not exists animals_father_idx on animals (father_id);
create index if not exists animals_pairing_idx on animals (pairing_id);

-- Parents and pairing must belong to the same user (so nobody can link to another breeder's animals).
-- The checks run in security-definer helpers: a policy on animals that queried animals directly would re-apply
-- itself and fail with "infinite recursion detected in policy".
create or replace function clutchly_owns_animal(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from animals where id = a and user_id = auth.uid()) $$;
create or replace function clutchly_owns_pairing(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pairings where id = p and user_id = auth.uid()) $$;
revoke all on function clutchly_owns_animal(uuid), clutchly_owns_pairing(uuid) from public, anon;
grant execute on function clutchly_owns_animal(uuid), clutchly_owns_pairing(uuid) to authenticated;

drop policy if exists own on animals;
create policy own on animals for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (mother_id is null or clutchly_owns_animal(mother_id))
    and (father_id is null or clutchly_owns_animal(father_id))
    and (pairing_id is null or clutchly_owns_pairing(pairing_id)));

-- Sex: hatchlings are usually unsexed, so 'Unknown' joins 'Female' and 'Male'.
alter table animals drop constraint if exists animals_sex_check;
alter table animals add constraint animals_sex_check check (sex in ('Female', 'Male', 'Unknown'));
