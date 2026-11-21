-- Only needed if you ran an older schema.sql before this change. Safe to run more than once.
alter table season_settings
  add column if not exists female_every int,
  add column if not exists male_every int,
  add column if not exists prelay_to_lay int,
  add column if not exists ovul_to_lay int;
grant select, insert, update, delete on animals, events, pairings, season_settings to authenticated;
grant select on animal_status to authenticated;
