-- Hand an animal over to its buyer.
-- The seller makes a one-time link (code) on the animal. The buyer opens it, signs in and accepts: they get their own
-- copy of the animal with its feeding, shed and weight history and its genes, and the seller's animal is marked Sold.
-- Everything goes through the functions below (security definer, checked against auth.uid()); nobody can write the
-- table directly. Photos are not copied. Safe to run again.

create table if not exists transfers (
  code text primary key,                                   -- random, in the link; 10 letters/digits shown as XXXXX-XXXXX
  seller_id uuid not null default auth.uid() references auth.users on delete cascade,
  animal_id uuid not null references animals(id) on delete cascade,
  from_name text,                                          -- how the seller signs it, e.g. their business name
  include_notes boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  new_animal_id uuid
);
create index if not exists transfers_animal on transfers (animal_id);
alter table transfers enable row level security;
drop policy if exists "Sellers read their own transfers" on transfers;
create policy "Sellers read their own transfers" on transfers for select to authenticated using (seller_id = auth.uid());
revoke all on transfers from anon, authenticated;
grant select on transfers to authenticated;

-- 10 characters without look-alikes (no 0/O, 1/I/L).
create or replace function clutchly_transfer_code() returns text language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '' order by i)
  from (select gen_random_bytes(10) b) x, generate_series(0, 9) i
$$;
-- Accepts the code as typed or the whole link; ignores case, spaces and dashes.
create or replace function clutchly_clean_code(p text) returns text language sql immutable as $$
  select upper(regexp_replace(regexp_replace(coalesce(p, ''), '^.*/', ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Seller: make (or reuse) the link for one of their animals. Returns the code.
create or replace function create_transfer(p_animal uuid, p_from_name text default null, p_include_notes boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null or not exists (select 1 from animals where id = p_animal and user_id = auth.uid()) then
    raise exception 'transfer_not_found' using errcode = 'P0001';
  end if;
  select code into c from transfers
   where animal_id = p_animal and seller_id = auth.uid() and accepted_at is null and expires_at > now();
  if c is not null then
    update transfers set from_name = nullif(trim(p_from_name), ''), include_notes = coalesce(p_include_notes, false) where code = c;
    return c;
  end if;
  loop
    c := clutchly_transfer_code();
    begin
      insert into transfers (code, seller_id, animal_id, from_name, include_notes)
      values (c, auth.uid(), p_animal, nullif(trim(p_from_name), ''), coalesce(p_include_notes, false));
      return c;
    exception when unique_violation then -- try another code
    end;
  end loop;
end $$;

-- Seller: withdraw a link that hasn't been used.
create or replace function cancel_transfer(p_code text) returns void language sql security definer set search_path = public as $$
  delete from transfers where code = clutchly_clean_code(p_code) and seller_id = auth.uid() and accepted_at is null
$$;

-- Anyone with the code (signed in or not): what's being handed over. Null if the code is wrong or expired.
create or replace function transfer_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', t.code, 'from_name', t.from_name, 'expires_at', t.expires_at,
    'accepted', t.accepted_at is not null, 'mine', t.seller_id = auth.uid(),
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

-- Buyer: accept. Copies the animal, its history and genes into the buyer's collection and marks the seller's Sold.
-- Returns the new animal's id. The free-plan limit applies to the buyer as for any new animal.
create or replace function accept_transfer(p_code text) returns uuid language plpgsql security definer set search_path = public as $$
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

  -- The seller's own genes become the buyer's own genes (reusing one with the same name if they already have it).
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

  update transfers set accepted_by = uid, accepted_at = now(), new_animal_id = new_id where code = t.code;
  update animals set status = 'Sold', updated_at = now() where id = a.id and status <> 'Sold';
  return new_id;
end $$;

revoke all on function create_transfer(uuid, text, boolean), cancel_transfer(text), accept_transfer(text), transfer_preview(text),
  clutchly_transfer_code(), clutchly_clean_code(text) from public, anon, authenticated;
grant execute on function create_transfer(uuid, text, boolean), cancel_transfer(text), accept_transfer(text) to authenticated;
grant execute on function transfer_preview(text) to anon, authenticated;
