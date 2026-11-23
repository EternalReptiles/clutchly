-- Paradox: a one-off colour or pattern anomaly. Listed as a trait (like the line-bred ones) so an animal can show it,
-- but not predicted in clutches, since it isn't known to be inherited. Safe to run again.
insert into gene_library (id, species, name, inheritance, description, has_super, sort)
values ('paradox', null, 'Paradox', 'polygenic',
  'A one-off patch of colour or pattern that doesn''t match the rest of the animal. Not known to be inherited, so it isn''t predicted in clutches.',
  false, 34)
on conflict (id) do update set name = excluded.name, inheritance = excluded.inheritance, description = excluded.description,
  has_super = excluded.has_super, sort = excluded.sort, updated_at = now();
