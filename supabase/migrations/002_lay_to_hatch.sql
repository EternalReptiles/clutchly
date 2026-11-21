-- Adds the "days from lay to hatch" setting used for the estimated hatch date. Safe to run more than once.
alter table season_settings add column if not exists lay_to_hatch int;
-- Make the API see the new column straight away.
notify pgrst, 'reload schema';
