-- Genes and morphs.
-- gene_library: shared single genes and line-bred traits per species (read-only for users; add more here or in the dashboard).
-- user_genes:   a breeder's own extra genes (private).
-- animal_genes: which genes each animal has (private), used by the morph calculator.
-- inheritance: 'recessive' | 'incomplete_dominant' | 'dominant' | 'polygenic' (line-bred; not predicted by the calculator)

create table if not exists gene_library(
  id text primary key,                 -- e.g. 'carpet-jaguar'
  species text not null,               -- matches the app's species names
  name text not null,
  inheritance text not null check (inheritance in ('recessive', 'incomplete_dominant', 'dominant', 'polygenic')),
  description text,
  super_name text,                     -- name of the homozygous form for (incomplete) dominant genes
  warning text,                        -- health note shown by the calculator
  super_warning text,                  -- extra note when two copies are possible
  sort int not null default 0,
  updated_at timestamptz not null default now());
alter table gene_library enable row level security;
drop policy if exists "signed-in users can read" on gene_library;
create policy "signed-in users can read" on gene_library for select to authenticated using (true);
revoke all on gene_library from anon, authenticated; grant select on gene_library to authenticated;

create table if not exists user_genes(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  species text not null, name text not null,
  inheritance text not null check (inheritance in ('recessive', 'incomplete_dominant', 'dominant', 'polygenic')),
  description text, super_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), synced_at timestamptz not null default now());
alter table user_genes enable row level security;
drop policy if exists own on user_genes;
create policy own on user_genes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on user_genes to authenticated;
create index if not exists user_genes_sync_idx on user_genes (user_id, synced_at);

create table if not exists animal_genes(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  animal_id uuid not null references animals on delete cascade,
  gene_key text not null,              -- gene_library.id, or 'u:' || user_genes.id
  state text not null check (state in ('visual', 'super', 'het', 'possible_het')),
  het_pct int check (het_pct between 1 and 99),   -- for possible_het, e.g. 50 or 66
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), synced_at timestamptz not null default now(),
  unique (animal_id, gene_key));
alter table animal_genes enable row level security;
drop policy if exists own on animal_genes;
create policy own on animal_genes for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and clutchly_owns_animal(animal_id));
grant select, insert, update, delete on animal_genes to authenticated;
create index if not exists animal_genes_sync_idx on animal_genes (user_id, synced_at);
create index if not exists animal_genes_animal_idx on animal_genes (animal_id);

-- Offline sync (migration 005): last-write-wins and deletion records.
do $$ declare t text; begin
  foreach t in array array['user_genes', 'animal_genes'] loop
    execute format('drop trigger if exists touch on %I', t);
    execute format('create trigger touch before insert or update on %I for each row execute function clutchly_touch()', t);
    execute format('drop trigger if exists record_delete on %I', t);
    execute format('create trigger record_delete after delete on %I for each row execute function clutchly_record_delete()', t);
  end loop;
end $$;

-- Seed: genes as described by an Australian breeder. Re-running updates the text.
insert into gene_library (id, species, name, inheritance, description, super_name, warning, super_warning, sort) values
  ('carpet-albino', 'Carpet', 'Albino', 'recessive', 'T- (tyrosinase-negative). Removes dark melanin. Originated in Darwin carpet pythons.', null, null, null, 10),
  ('carpet-axanthic', 'Carpet', 'Axanthic', 'recessive', 'Strongly reduces or removes yellow and red pigment. Found in Coastal, Irian Jaya/Papuan and Australian lines.', null, null, null, 11),
  ('carpet-granite', 'Carpet', 'Granite', 'recessive', 'Breaks saddles and bands into pixelated, speckled scale clusters. Irian Jaya (M. s. harrisoni) lines and distinct Australian lines.', null, null, null, 12),
  ('carpet-silver-pepper', 'Carpet', 'Silver Pepper', 'recessive', 'Clean silver-grey ground colour with fine dark peppered speckling and solid black eyes. Murray Darling / Inland carpets (M. s. metcalfei).', null, null, null, 13),
  ('carpet-caramel', 'Carpet', 'Caramel', 'incomplete_dominant', 'Reduces melanin and brightens warm yellow and tan tones.', 'Super Caramel', null, 'Super Caramels can be hard to tell apart from single-gene Caramels.', 20),
  ('carpet-hypo', 'Carpet', 'Hypo', 'incomplete_dominant', 'Hypomelanistic: reduces dark pigment for brighter colour.', 'Super Hypo', null, 'Super Hypos show severe melanin reduction.', 21),
  ('carpet-jaguar', 'Carpet', 'Jaguar', 'incomplete_dominant', 'Heavily reduces dark pigment and alters pattern.', 'Super Jaguar', 'Jaguar is linked to neurological problems ("wobble").', 'Two copies (Super Jaguar) are linked to embryonic death and severe neurological problems. Many breeders avoid pairing Jaguar to Jaguar.', 22),
  ('carpet-zebra', 'Carpet', 'Zebra', 'incomplete_dominant', 'Fine, banded pattern shifts.', 'Super Zebra', null, 'Super Zebras are largely patternless and can carry a risk of tail kinks.', 23),
  ('carpet-tiger', 'Carpet', 'Tiger', 'polygenic', 'Line-bred: several genes and selective breeding, not a single gene.', null, null, null, 30),
  ('carpet-striped', 'Carpet', 'Striped', 'polygenic', 'Line-bred: several genes and selective breeding, not a single gene.', null, null, null, 31),
  ('carpet-red-coastal', 'Carpet', 'Red Coastal', 'polygenic', 'Line-bred: several genes and selective breeding, not a single gene.', null, null, null, 32),
  ('bredli-stripe', 'Bredli', 'Stripe', 'recessive', 'Replaces cross-banding with a continuous dorsal stripe.', null, null, null, 10),
  ('bredli-hypo', 'Bredli', 'Hypo', 'incomplete_dominant', 'Reduces the black borders around the saddles for cleaner, brighter orange-red colour.', 'Super Hypo', null, null, 20),
  ('bredli-stonewash', 'Bredli', 'Stonewash', 'incomplete_dominant', 'Washes dark pigment out into soft greys and lavenders.', 'Super Stonewash', null, 'Super Stonewash animals are heavily reduced in dark pigment.', 21),
  ('antaresia-t-albino', 'Antaresia', 'T- Albino', 'recessive', 'Spotted (A. maculosa). Amelanistic: removes dark melanin, leaving white, yellow and pink tones.', null, null, null, 10),
  ('antaresia-t-plus-albino-childrens', 'Antaresia', 'T+ Albino (Children''s)', 'recessive', 'Children''s (A. childreni). Reduces dark melanin for soft orange, lavender and caramel tones.', null, null, null, 11),
  ('antaresia-t-plus-albino-rays-leaheys', 'Antaresia', 'T+ Albino (Ray''s / Leahey''s)', 'recessive', 'Stimson''s (A. stimsoni). Ray''s and Leahey''s lines are compatible; bright orange and terracotta-red tones.', null, null, null, 12),
  ('antaresia-t-plus-albino-evans', 'Antaresia', 'T+ Albino (Evans)', 'recessive', 'Stimson''s (A. stimsoni). Not compatible with Ray''s / Leahey''s; paler cream and pastel colours, often blue eyes.', null, null, null, 13),
  ('antaresia-granite-spotted', 'Antaresia', 'Granite (Spotted line)', 'recessive', 'Spotted (A. maculosa). Breaks blotches into fine, speckled patterns.', null, null, null, 14),
  ('antaresia-granite-childrens', 'Antaresia', 'Granite (Children''s line)', 'recessive', 'Children''s (A. childreni). A distinct line that fractures dorsal blotches into speckled markings.', null, null, null, 15),
  ('antaresia-marble', 'Antaresia', 'Marble', 'recessive', 'Children''s (A. childreni), including Patch Marble. Bold, irregular pied-like patches of orange, yellow, cream and brown.', null, null, null, 16),
  ('antaresia-axanthic', 'Antaresia', 'Axanthic', 'recessive', 'Spotted (A. maculosa). Strips yellow and warm pigments, leaving dark grey, silver and charcoal tones.', null, null, null, 17),
  ('antaresia-ghost', 'Antaresia', 'Ghost', 'recessive', 'Children''s (A. childreni). Hypomelanistic: pale, silvery-grey appearance.', null, null, null, 18),
  ('antaresia-platinum', 'Antaresia', 'Platinum', 'incomplete_dominant', 'Spotted (A. maculosa). Diluted, silvery-grey ground colour and reduced dark blotches.', 'Super Platinum', null, 'Super Platinums are dramatically paler, near-white to silver.', 20),
  ('antaresia-comino', 'Antaresia', 'Comino', 'incomplete_dominant', 'Spotted (A. maculosa). Striped Spotted: shifts dorsal blotches into longitudinal striping.', 'Super Comino', null, null, 21),
  ('antaresia-blonde', 'Antaresia', 'Blonde Spotted', 'polygenic', 'Line-bred for a bright, clean cream-to-gold background.', null, null, null, 30),
  ('antaresia-patternless', 'Antaresia', 'Patternless', 'polygenic', 'Children''s and Pygmy. Dorsal pattern fades completely with age (polygenic).', null, null, null, 31),
  ('antaresia-sunburst', 'Antaresia', 'Sunburst', 'polygenic', 'Stimson''s locality / line-bred trait selected for high orange and yellow.', null, null, null, 32),
  ('antaresia-wheatbelt', 'Antaresia', 'Wheatbelt / Tri-colour', 'polygenic', 'Stimson''s locality / line-bred trait selected for crisp tri-colour contrast.', null, null, null, 33)
on conflict (id) do update set species = excluded.species, name = excluded.name, inheritance = excluded.inheritance,
  description = excluded.description, super_name = excluded.super_name, warning = excluded.warning,
  super_warning = excluded.super_warning, sort = excluded.sort, updated_at = now();
