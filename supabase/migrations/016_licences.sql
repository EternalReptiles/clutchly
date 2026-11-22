-- Wildlife licence details, and swapping them in a handover.
-- Each user can save their licence once (Account > Wildlife licence). When making a handover link the seller can tick
-- "Include my licence details"; when accepting, the buyer can tick "Share my licence details with the seller". The
-- details are copied into the handover at that moment (so the record stays as it was if a licence changes later),
-- and both people can read that handover. Nothing is shared through the link itself before it is accepted.
-- Accepted handovers are kept as each side's record even if the animal or the other account is later deleted.
-- Safe to run again.

create table if not exists licences (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  full_name text, licence_no text, region text, licence_class text, expires date, address text, phone text,
  updated_at timestamptz not null default now()
);
alter table licences enable row level security;
drop policy if exists "Own licence" on licences;
create policy "Own licence" on licences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on licences from anon;
grant select, insert, update, delete on licences to authenticated;

alter table transfers add column if not exists share_seller_licence boolean not null default false;
alter table transfers add column if not exists seller_licence jsonb;
alter table transfers add column if not exists buyer_licence jsonb;
alter table transfers add column if not exists animal_name text;
alter table transfers add column if not exists species text;
update transfers t set animal_name = a.name, species = a.species from animals a where a.id = t.animal_id and t.animal_name is null;
-- Keep the record when the seller's animal or either account goes. (A pending link whose animal is deleted stops
-- working: the functions below need the animal.)
alter table transfers alter column animal_id drop not null, alter column seller_id drop not null;
alter table transfers drop constraint if exists transfers_animal_id_fkey, drop constraint if exists transfers_seller_id_fkey;
alter table transfers add constraint transfers_animal_id_fkey foreign key (animal_id) references animals(id) on delete set null,
  add constraint transfers_seller_id_fkey foreign key (seller_id) references auth.users on delete set null;
create index if not exists transfers_new_animal on transfers (new_animal_id);
create index if not exists transfers_buyer on transfers (accepted_by);

drop policy if exists "Sellers read their own transfers" on transfers;
drop policy if exists "Both sides read their transfers" on transfers;
create policy "Both sides read their transfers" on transfers for select to authenticated using (seller_id = auth.uid() or accepted_by = auth.uid());

-- The details as they are now, for copying into a handover (null if none saved).
create or replace function clutchly_licence_of(uid uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object('full_name', full_name, 'licence_no', licence_no, 'region', region, 'licence_class', licence_class,
    'expires', expires, 'address', address, 'phone', phone))
  from licences where user_id = uid and coalesce(nullif(trim(licence_no), ''), nullif(trim(full_name), '')) is not null
$$;

drop function if exists create_transfer(uuid, text, boolean);
create or replace function create_transfer(p_animal uuid, p_from_name text default null, p_include_notes boolean default false,
  p_share_licence boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare c text; a animals;
begin
  select * into a from animals where id = p_animal and user_id = auth.uid();
  if auth.uid() is null or not found then raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  select code into c from transfers
   where animal_id = p_animal and seller_id = auth.uid() and accepted_at is null and expires_at > now();
  if c is not null then
    update transfers set from_name = nullif(trim(p_from_name), ''), include_notes = coalesce(p_include_notes, false),
      share_seller_licence = coalesce(p_share_licence, false), animal_name = a.name, species = a.species where code = c;
    return c;
  end if;
  loop
    c := clutchly_transfer_code();
    begin
      insert into transfers (code, seller_id, animal_id, from_name, include_notes, share_seller_licence, animal_name, species)
      values (c, auth.uid(), p_animal, nullif(trim(p_from_name), ''), coalesce(p_include_notes, false), coalesce(p_share_licence, false), a.name, a.species);
      return c;
    exception when unique_violation then -- try another code
    end;
  end loop;
end $$;

create or replace function transfer_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', t.code, 'from_name', t.from_name, 'expires_at', t.expires_at,
    'accepted', t.accepted_at is not null, 'mine', t.seller_id = auth.uid(), 'seller_licence', t.share_seller_licence,
    'name', a.name, 'species', a.species, 'sex', a.sex, 'dob', a.dob,
    'genes', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(gl.name, ug.name, g.gene_key), 'state', g.state, 'het_pct', g.het_pct) order by g.created_at)
      from animal_genes g left join gene_library gl on gl.id = g.gene_key
      left join user_genes ug on g.gene_key = 'u:' || ug.id::text and ug.user_id = t.seller_id
      where g.animal_id = a.id), '[]'::jsonb),
    'feeds', (select count(*) from events e where e.animal_id = a.id and e.kind = 'feed'),
    'sheds', (select count(*) from events e where e.animal_id = a.id and e.kind = 'shed'),
    'weights', (select count(*) from events e where e.animal_id = a.id and e.kind = 'weight'))
  from transfers t join animals a on a.id = t.animal_id
  where t.code = clutchly_clean_code(p_code) and t.expires_at > now()
$$;

drop function if exists accept_transfer(text);
create or replace function accept_transfer(p_code text, p_share_licence boolean default false) returns uuid
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

  if a.mother_id is not null or a.father_id is not null then
    parents := coalesce((select name from animals where id = a.mother_id), '?') || ' × ' || coalesce((select name from animals where id = a.father_id), '?');
  end if;
  note := concat_ws(E'\n',
    'From ' || coalesce(t.from_name, 'a breeder') || ' on ' || to_char(now() at time zone 'Australia/Sydney', 'FMDD Mon YYYY') || '.',
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
    seller_licence = case when t.share_seller_licence then clutchly_licence_of(t.seller_id) end,
    buyer_licence = case when p_share_licence then clutchly_licence_of(uid) end
   where code = t.code;
  update animals set status = 'Sold', updated_at = now() where id = a.id and status <> 'Sold';
  return new_id;
end $$;

revoke all on function create_transfer(uuid, text, boolean, boolean), accept_transfer(text, boolean), transfer_preview(text),
  clutchly_licence_of(uuid) from public, anon, authenticated;
grant execute on function create_transfer(uuid, text, boolean, boolean), accept_transfer(text, boolean) to authenticated;
grant execute on function transfer_preview(text) to anon, authenticated;
