-- Shared starting values per species, offered to users during onboarding and on the Season tab.
-- Every signed-in user can read them; nobody can change them from the app (no insert/update/delete grants).
-- Edit them here (a new migration) or in the Supabase dashboard. Applying a template copies its values into the
-- user's own season_settings, so later edits by the user never touch this table.
-- Dates are 'MM-DD' for the SOUTHERN hemisphere; the app shifts them by six months for northern-hemisphere users.
create table if not exists species_templates(
  species text primary key,
  male_every int,               -- days between feeds for males
  female_every int,             -- days between feeds for females
  pause_from text,              -- feeding pause start 'MM-DD'
  pause_to text,                -- feeding resumes after 'MM-DD'
  pair_start text,              -- pairing starts 'MM-DD'
  prelay_to_lay int,            -- days from pre-lay shed to lay
  ovul_to_lay int,              -- days from ovulation to lay
  lay_to_hatch int,             -- days from lay to hatch
  notes text,
  updated_at timestamptz not null default now());
alter table species_templates enable row level security;
drop policy if exists "signed-in users can read" on species_templates;
create policy "signed-in users can read" on species_templates for select to authenticated using (true);
revoke all on species_templates from anon, authenticated;
grant select on species_templates to authenticated;

-- Starting values from an Australian breeder's routine (pythons fed until April, cleared out in May).
-- Notes avoid month names because northern-hemisphere users see the dates shifted.
-- Lay and hatch days are the middle of the typical ranges for each species.
insert into species_templates (species, male_every, female_every, pause_from, pause_to, pair_start, prelay_to_lay, ovul_to_lay, lay_to_hatch, notes) values
  ('Carpet',    21, 7, '05-01', '05-31', '06-01', 25, 49, 55, 'Paired after a month without food to clear out. Pre-lay shed to lay is usually 21-28 days.'),
  ('Bredli',    21, 7, '05-01', '05-31', '08-01', 30, 58, 60, 'Paired two months after carpets. Pre-lay shed to lay is usually 25-35 days.'),
  ('Diamond',   21, 7, '05-01', '05-31', '09-01', 25, 49, 55, 'Paired three months after carpets. Pre-lay shed to lay is usually 21-28 days.'),
  ('Antaresia', 21, 7, '05-01', '05-31', '06-01', 24, 42, 52, 'Paired after a month without food to clear out. Pre-lay shed to lay is usually 20-28 days.')
on conflict (species) do update set male_every = excluded.male_every, female_every = excluded.female_every,
  pause_from = excluded.pause_from, pause_to = excluded.pause_to, pair_start = excluded.pair_start,
  prelay_to_lay = excluded.prelay_to_lay, ovul_to_lay = excluded.ovul_to_lay, lay_to_hatch = excluded.lay_to_hatch,
  notes = excluded.notes, updated_at = now();
