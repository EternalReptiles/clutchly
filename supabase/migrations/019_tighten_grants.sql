-- Defence in depth: Supabase's defaults give the app's roles TRUNCATE, REFERENCES and TRIGGER on every table. The app
-- never needs them (row-level security doesn't apply to TRUNCATE), so take them away, now and for tables made later.
-- Safe to run again.
do $$ declare t text; begin
  for t in select table_name from information_schema.tables where table_schema = 'public' loop  -- tables and views
    execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', t);
  end loop;
end $$;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
