-- Handovers always swap licence details: the seller and buyer must each have their full name, wildlife licence number
-- and address saved (Account > Wildlife licence), and both sets are copied into the handover when it's accepted.
-- The p_share_licence parameters stay for older app versions but no longer change anything. Safe to run again.

create or replace function clutchly_licence_complete(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from licences where user_id = uid
    and nullif(trim(full_name), '') is not null and nullif(trim(licence_no), '') is not null and nullif(trim(address), '') is not null)
$$;
revoke all on function clutchly_licence_complete(uuid) from public, anon, authenticated;

create or replace function create_transfer(p_animal uuid, p_from_name text default null, p_include_notes boolean default false,
  p_share_licence boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare c text; a animals;
begin
  select * into a from animals where id = p_animal and user_id = auth.uid();
  if auth.uid() is null or not found then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(auth.uid()) then raise exception 'licence_required' using errcode = 'P0001'; end if;
  select code into c from transfers
   where animal_id = p_animal and seller_id = auth.uid() and accepted_at is null and expires_at > now();
  if c is not null then
    update transfers set from_name = nullif(trim(p_from_name), ''), include_notes = coalesce(p_include_notes, false),
      share_seller_licence = true, animal_name = a.name, species = a.species where code = c;
    return c;
  end if;
  loop
    c := clutchly_transfer_code();
    begin
      insert into transfers (code, seller_id, animal_id, from_name, include_notes, share_seller_licence, animal_name, species)
      values (c, auth.uid(), p_animal, nullif(trim(p_from_name), ''), coalesce(p_include_notes, false), true, a.name, a.species);
      return c;
    exception when unique_violation then -- try another code
    end;
  end loop;
end $$;

create or replace function accept_transfer(p_code text, p_share_licence boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare t transfers; a animals; uid uuid := auth.uid(); new_id uuid; parents text; note text;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into t from transfers where code = clutchly_clean_code(p_code) for update;
  if not found or t.expires_at <= now() then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if t.accepted_at is not null then raise exception 'transfer_used' using errcode = 'P0001'; end if;
  if t.seller_id = uid then raise exception 'transfer_own_animal' using errcode = 'P0001'; end if;
  select * into a from animals where id = t.animal_id and user_id = t.seller_id;
  if not found then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(uid) then raise exception 'licence_required' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(t.seller_id) then raise exception 'seller_licence_missing' using errcode = 'P0001'; end if;

  if a.mother_id is not null or a.father_id is not null then
    parents := coalesce((select name from animals where id = a.mother_id), '?') || ' × ' || coalesce((select name from animals where id = a.father_id), '?');
  end if;
  note := concat_ws(E'\n',
    'From ' || coalesce(t.from_name, (select full_name from licences where user_id = t.seller_id), 'a breeder') || ' on ' || to_char(now() at time zone 'Australia/Sydney', 'FMDD Mon YYYY') || '.',
    'Parents: ' || parents,
    case when t.include_notes then nullif(trim(a.notes), '') end);

  insert into animals (user_id, name, species, sex, status, dob, feed_every, notes)
  values (uid, a.name, a.species, a.sex, 'Active', a.dob, a.feed_every, note)
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
  return new_id;
end $$;

revoke all on function create_transfer(uuid, text, boolean, boolean), accept_transfer(text, boolean) from public, anon, authenticated;
grant execute on function create_transfer(uuid, text, boolean, boolean), accept_transfer(text, boolean) to authenticated;
