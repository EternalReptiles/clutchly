-- Handovers need the seller's approval, so a link that reaches the wrong person can't take the animal.
--   Buyer: accept_transfer now only asks. Their name, licence and address go to the seller with the request.
--   Seller: approve_transfer copies the animal, history and genes to the buyer and swaps licences; decline_transfer
--   clears the request (the link works again). The buyer can withdraw_request.
-- Photos are copied by the handover-approve Edge Function, which calls approve_transfer as the seller and then copies
-- the files it lists (storage can't be copied from SQL). One request at a time per link. Safe to run again.

alter table transfers add column if not exists requested_by uuid references auth.users on delete set null;
alter table transfers add column if not exists requested_at timestamptz;
create index if not exists transfers_requested_by on transfers (requested_by);

drop policy if exists "Both sides read their transfers" on transfers;
create policy "Both sides read their transfers" on transfers for select to authenticated
  using (seller_id = auth.uid() or accepted_by = auth.uid() or requested_by = auth.uid());

-- Whether a user is Pro, for the database's own checks. is_pro() only answers for the signed-in user (so nobody can
-- look up someone else's plan), which made the free limit apply to a Pro buyer when the seller approved a handover.
create or replace function clutchly_pro(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from subscriptions s where s.user_id = uid and s.entitlement = 'pro' and s.active
                 and (s.expires_at is null or s.expires_at > now()))
$$;
revoke all on function clutchly_pro(uuid) from public, anon, authenticated;

-- The free limit on owned animals (migration 010), now checking the plan of the animal's owner whoever adds it.
create or replace function enforce_free_animal_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  -- Only adding an owned animal, or turning a Sold animal back into an owned one, uses up a place.
  if new.status = 'Sold' then return new; end if;
  if tg_op = 'UPDATE' and old.status is distinct from 'Sold' then return new; end if;
  if clutchly_pro(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('animal-limit:' || new.user_id::text));
  select value into lim from app_limits where key = 'free_animals';
  select count(*) into n from animals where user_id = new.user_id and status <> 'Sold' and id <> new.id;
  if lim is not null and n >= lim then
    raise exception 'free_limit_reached: free accounts can have up to % animals (animals marked Sold do not count)', lim using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Copied photos are recorded by the handover-approve Edge Function, which uses the service role.
grant select, insert, delete on animal_photos to service_role;

-- Room for one more owned animal on the user's plan (the insert trigger still has the final say).
create or replace function clutchly_has_room(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select clutchly_pro(uid) or (select count(*) from animals where user_id = uid and status <> 'Sold')
    < coalesce((select value from app_limits where key = 'free_animals'), 2147483647)
$$;

create or replace function transfer_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', t.code, 'from_name', t.from_name, 'expires_at', t.expires_at,
    'accepted', t.accepted_at is not null, 'mine', t.seller_id = auth.uid(), 'seller_licence', true,
    'requested', t.requested_by is not null and t.accepted_at is null,
    'requested_by_me', t.requested_by is not null and t.requested_by = auth.uid() and t.accepted_at is null,
    'new_animal_id', case when t.accepted_by = auth.uid() then t.new_animal_id end,
    'name', a.name, 'species', a.species, 'sex', a.sex, 'dob', a.dob,
    'genes', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(gl.name, ug.name, g.gene_key), 'state', g.state, 'het_pct', g.het_pct) order by g.created_at)
      from animal_genes g left join gene_library gl on gl.id = g.gene_key
      left join user_genes ug on g.gene_key = 'u:' || ug.id::text and ug.user_id = t.seller_id
      where g.animal_id = a.id), '[]'::jsonb),
    'photos', (select count(*) from animal_photos ph where ph.animal_id = a.id),
    'feeds', (select count(*) from events e where e.animal_id = a.id and e.kind = 'feed'),
    'sheds', (select count(*) from events e where e.animal_id = a.id and e.kind = 'shed'),
    'weights', (select count(*) from events e where e.animal_id = a.id and e.kind = 'weight'))
  from transfers t join animals a on a.id = t.animal_id
  where t.code = clutchly_clean_code(p_code) and t.expires_at > now()
$$;

-- Buyer: ask for the animal. Returns null (nothing is copied until the seller approves).
create or replace function accept_transfer(p_code text, p_share_licence boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare t transfers; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into t from transfers where code = clutchly_clean_code(p_code) for update;
  if not found or t.expires_at <= now() or not exists (select 1 from animals where id = t.animal_id and user_id = t.seller_id) then
    raise exception 'transfer_not_found' using errcode = 'P0001'; end if;
  if t.accepted_at is not null then raise exception 'transfer_used' using errcode = 'P0001'; end if;
  if t.seller_id = uid then raise exception 'transfer_own_animal' using errcode = 'P0001'; end if;
  if t.requested_by is not null and t.requested_by <> uid then raise exception 'transfer_requested' using errcode = 'P0001'; end if;
  if not clutchly_licence_complete(uid) then raise exception 'licence_required' using errcode = 'P0001'; end if;
  if not clutchly_has_room(uid) then
    raise exception 'free_limit_reached: free accounts can have up to % animals (animals marked Sold do not count)',
      (select value from app_limits where key = 'free_animals') using errcode = 'P0001'; end if;
  update transfers set requested_by = uid, requested_at = now(), buyer_licence = clutchly_licence_of(uid) where code = t.code;
  return null;
end $$;

-- Buyer: take a request back.
create or replace function withdraw_request(p_code text) returns void language sql security definer set search_path = public as $$
  update transfers set requested_by = null, requested_at = null, buyer_licence = null
   where code = clutchly_clean_code(p_code) and requested_by = auth.uid() and accepted_at is null
$$;

-- Seller: say no to a request; the link can be used again (or cancelled).
create or replace function decline_transfer(p_code text) returns void language sql security definer set search_path = public as $$
  update transfers set requested_by = null, requested_at = null, buyer_licence = null
   where code = clutchly_clean_code(p_code) and seller_id = auth.uid() and accepted_at is null
$$;

-- Seller: approve. Copies the animal, history and genes into the buyer's collection, swaps licences, marks the
-- seller's animal Sold. Returns the buyer, the new animal and the photos for the Edge Function to copy.
create or replace function approve_transfer(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t transfers; a animals; uid uuid; new_id uuid; parents text; note text;
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

  -- The buyer's free limit applies here as for any new animal (raises free_limit_reached).
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
  return jsonb_build_object('new_animal_id', new_id, 'buyer_id', uid,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', ph.path, 'is_cover', ph.is_cover, 'created_at', ph.created_at) order by ph.created_at)
      from animal_photos ph where ph.animal_id = a.id), '[]'::jsonb));
end $$;

revoke all on function clutchly_has_room(uuid), transfer_preview(text), accept_transfer(text, boolean), withdraw_request(text),
  decline_transfer(text), approve_transfer(text) from public, anon, authenticated;
grant execute on function transfer_preview(text) to anon, authenticated;
grant execute on function accept_transfer(text, boolean), withdraw_request(text), decline_transfer(text), approve_transfer(text) to authenticated;
