-- Genes are generic: no species. A gene is picked for any animal (Albino in an Olive python, Axanthic in a BHP ...).
-- 1. Species becomes optional (kept only as background); the app no longer uses it.
alter table gene_library alter column species drop not null;
alter table user_genes alter column species drop not null;
alter table morph_combos alter column species drop not null;
update gene_library set species = null;
update morph_combos set species = null;

-- 2. One gene per name. Axanthic and Hypo were listed twice; animals keep their genes under the remaining id.
create temp table gene_merge(old_id text, new_id text) on commit drop;
insert into gene_merge values ('antaresia-axanthic', 'carpet-axanthic'), ('bredli-hypo', 'carpet-hypo');
delete from animal_genes a using gene_merge m
  where a.gene_key = m.old_id and exists (select 1 from animal_genes b where b.animal_id = a.animal_id and b.gene_key = m.new_id);
update animal_genes a set gene_key = m.new_id, updated_at = now() from gene_merge m where a.gene_key = m.old_id;
delete from gene_library where id in (select old_id from gene_merge);

-- 3. Descriptions without species or locality notes.
update gene_library set description = case id
  when 'carpet-albino' then 'T- (tyrosinase-negative). Removes dark melanin.'
  when 'carpet-axanthic' then 'Strongly reduces or removes yellow and red pigment, leaving greys, silvers and black.'
  when 'carpet-granite' then 'Breaks saddles and bands into pixelated, speckled scale clusters.'
  when 'carpet-silver-pepper' then 'Clean silver-grey ground colour with fine dark peppered speckling and solid black eyes.'
  when 'antaresia-t-albino' then 'Amelanistic: removes dark melanin, leaving white, yellow and pink tones.'
  when 'antaresia-t-plus-albino-childrens' then 'Reduces dark melanin for soft orange, lavender and caramel tones.'
  when 'antaresia-granite-spotted' then 'Breaks blotches into fine, speckled patterns.'
  when 'antaresia-granite-childrens' then 'A distinct granite line that fractures dorsal blotches into speckles.'
  when 'antaresia-marble' then 'Bold, irregular pied-like patches. Includes Patch Marble.'
  when 'antaresia-ghost' then 'Hypomelanistic: pale, silvery-grey appearance.'
  when 'antaresia-platinum' then 'Diluted, silvery-grey ground colour and reduced dark blotches.'
  when 'antaresia-comino' then 'Shifts dorsal blotches into longitudinal striping.'
  when 'bredli-stripe' then 'Replaces cross-banding with a continuous dorsal stripe.'
  when 'bredli-stonewash' then 'Washes dark pigment out into soft greys and lavenders.'
  else description end,
  updated_at = now();

-- 4. Comino and Stonewash: dominant, no known super form (one or two copies look the same).
update gene_library set inheritance = 'dominant', super_name = null, super_warning = null, updated_at = now()
  where id in ('antaresia-comino', 'bredli-stonewash');
update animal_genes set state = 'visual', updated_at = now()
  where gene_key in ('antaresia-comino', 'bredli-stonewash') and state = 'super';
