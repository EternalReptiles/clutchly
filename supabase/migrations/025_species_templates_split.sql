-- Starting values for the species added in lib/species.ts: Jungle and Coastal copy Carpet; Children's, Spotted,
-- Stimson's and Pygmy pythons copy Antaresia, which is taken off the species list (and its template removed).
insert into species_templates (species, male_every, female_every, pause_from, pause_to, pair_start, prelay_to_lay, ovul_to_lay, lay_to_hatch, notes, updated_at)
select n.species, t.male_every, t.female_every, t.pause_from, t.pause_to, t.pair_start, t.prelay_to_lay, t.ovul_to_lay, t.lay_to_hatch, t.notes, now()
from (values ('Jungle', 'Carpet'), ('Coastal', 'Carpet'),
             ('Children''s python', 'Antaresia'), ('Spotted python', 'Antaresia'), ('Stimson''s python', 'Antaresia'), ('Pygmy python', 'Antaresia')) as n(species, src)
join species_templates t on t.species = n.src
on conflict (species) do nothing;

delete from species_templates where species = 'Antaresia';
