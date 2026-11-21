-- 1. Genes whose double-copy form doesn't exist or isn't viable (has_super = false). Jaguar is always visual: no hets,
--    no supers. Jaguar x Jaguar is not recommended; the calculator warns and leaves out the non-viable eggs.
alter table gene_library add column if not exists has_super boolean not null default true;
update gene_library set inheritance = 'dominant', has_super = false, super_name = null,
  description = 'Heavily reduces dark pigment and alters pattern. Always visual: there are no het or super Jaguars.',
  warning = 'Jaguar is linked to neurological problems ("wobble").',
  super_warning = 'Pairing Jaguar to Jaguar is not recommended. The double-copy form is not viable, so about 1 in 4 eggs are expected not to develop, and every Jaguar baby still carries the wobble risk.',
  updated_at = now()
where id = 'carpet-jaguar';
-- Existing records: a "Super Jaguar" is recorded as a Jaguar.
update animal_genes set state = 'visual' where gene_key = 'carpet-jaguar' and state <> 'visual';

-- 2. Combination morphs: a name for animals that show certain genes together, e.g. Albino + Axanthic = Snow.
--    groups: a list of requirements; each requirement is a list of gene ids, any one of which counts.
--    When several combinations match, the one with the most requirements wins (Moonglow over Snow).
create table if not exists morph_combos(
  id text primary key,
  species text not null,
  name text not null,
  groups jsonb not null,
  description text,
  updated_at timestamptz not null default now());
alter table morph_combos enable row level security;
drop policy if exists "signed-in users can read" on morph_combos;
create policy "signed-in users can read" on morph_combos for select to authenticated using (true);
revoke all on morph_combos from anon, authenticated; grant select on morph_combos to authenticated;

insert into morph_combos (id, species, name, groups, description) values
  ('carpet-sunglow',  'Carpet', 'Sunglow',  '[["carpet-caramel","carpet-hypo"],["carpet-albino"]]', 'Caramel or Hypo with Albino.'),
  ('carpet-moonglow', 'Carpet', 'Moonglow', '[["carpet-caramel","carpet-hypo"],["carpet-albino"],["carpet-axanthic"]]', 'Caramel or Hypo with Albino and Axanthic.'),
  ('carpet-snow',     'Carpet', 'Snow',     '[["carpet-albino"],["carpet-axanthic"]]', 'Albino with Axanthic.'),
  ('carpet-ghost',    'Carpet', 'Ghost',    '[["carpet-caramel","carpet-hypo"],["carpet-axanthic"]]', 'Caramel or Hypo with Axanthic.')
on conflict (id) do update set species = excluded.species, name = excluded.name, groups = excluded.groups,
  description = excluded.description, updated_at = now();
