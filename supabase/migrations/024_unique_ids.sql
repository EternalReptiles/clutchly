-- One ID per animal in each collection (ignoring capitals and spaces at the ends). The app checks first and says
-- "This ID already exists"; this is the backstop (e.g. two phones adding the same ID while offline). A handover whose
-- ID the buyer already uses arrives as "ID (2)". Safe to run again.

create unique index if not exists animals_unique_name on animals (user_id, lower(btrim(name)));

create or replace function approve_transfer(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t transfers; a animals; uid uuid; new_id uuid; parents text; note text; new_name text; n int := 1;
begin
  select * into t from transfers where code = clutchly_clean_code(p_code) and seller_id = auth.uid() for update;
  if auth.uid() is null or not found or t.expires_at <= now() then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if t.accepted_at is not null then raise exception 'transfer_used' using errcode = 'P0001'; end if;
  uid := t.requested_by;
  if uid is null then raise exception 'transfer_no_request' using errcode = 'P0001'; end if;
  select * into a from animals where id = t.animal_id and user_id = t.seller_id;
  if not found then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(t.seller_id) then raise exception 'licence_required' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(uid) then raise exception 'buyer_licence_missing' using errcode = 'P0001'; end if;

  if a.mother_id is not null or a.father_id is not null then
    parents := coalesce((select name from animals where id = a.mother_id), '?') || ' × ' || coalesce((select name from animals where id = a.father_id), '?');
  end if;
  note := concat_ws(E'\n',
    'From ' || coalesce(t.from_name, (select full_name from licences where user_id = t.seller_id), 'a breeder') || ' on ' || to_char(now() at time zone 'Australia/Sydney', 'FMDD Mon YYYY') || '.',
    'Parents: ' || parents,
    case when t.include_notes then nullif(trim(a.notes), '') end);

  -- IDs are unique in each collection: if the buyer already has this one, the copy becomes "ID (2)", "ID (3)"...
  new_name := a.name;
  while exists (select 1 from animals where user_id = uid and lower(btrim(name)) = lower(btrim(new_name))) loop
    n := n + 1; new_name := a.name || ' (' || n || ')';
  end loop;
  -- The buyer's free limit applies here as for any new animal (raises free_limit_reached).
  insert into animals (user_id, name, species, sex, status, dob, feed_every, notes)
  values (uid, new_name, a.species, a.sex, 'Active', a.dob, a.feed_every, note)
  returning id into new_id;

  insert into events (user_id, animal_id, kind, on_date, ok, food, grams, note, created_at)
  select uid, new_id, e.kind, e.on_date, e.ok, e.food, e.grams, case when t.include_notes then e.note end, e.created_at
    from events e where e.animal_id = a.id;

  insert into user_genes (user_id, species, name, inheritance, description, super_name)
  select uid, ug.species, ug.name, ug.inheritance, ug.description, ug.super_name
    from user_genes ug
   where ug.user_id = t.seller_id
     and exists (select 1 from animal_genes g where g.animal_id = a.id and g.gene_key = 'u:' || ug.id::text)
     and not exists (select 1 from user_genes mine where mine.user_id = uid and lower(mine.name) = lower(ug.name));
  insert into animal_genes (user_id, animal_id, gene_key, state, het_pct)
  select uid, new_id,
         case when g.gene_key like 'u:%' then coalesce(
           (select 'u:' || mine.id::text from user_genes ug join user_genes mine on mine.user_id = uid and lower(mine.name) = lower(ug.name)
             where 'u:' || ug.id::text = g.gene_key and ug.user_id = t.seller_id order by mine.created_at limit 1), g.gene_key)
              else g.gene_key end,
         g.state, g.het_pct
    from animal_genes g where g.animal_id = a.id;

  update transfers set accepted_by = uid, accepted_at = now(), new_animal_id = new_id, animal_name = a.name, species = a.species,
    share_seller_licence = true, seller_licence = clutchly_licence_of(t.seller_id), buyer_licence = clutchly_licence_of(uid)
   where code = t.code;
  update animals set status = 'Sold', updated_at = now() where id = a.id and status <> 'Sold';
  return jsonb_build_object('new_animal_id', new_id, 'buyer_id', uid,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', ph.path, 'is_cover', ph.is_cover, 'created_at', ph.created_at) order by ph.created_at)
      from animal_photos ph where ph.animal_id = a.id), '[]'::jsonb));
end $$;
