-- The free limit counts OWNED animals only: animals marked Sold don't count.
-- To stop the limit being bypassed by marking animals Sold, adding more, then marking them back, changing an animal
-- from Sold to any other status is checked against the limit too.
update app_limits set note = 'Owned animals a free account can have (animals marked Sold do not count).' where key = 'free_animals';

create or replace function enforce_free_animal_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  -- Only adding an owned animal, or turning a Sold animal back into an owned one, uses up a place.
  if new.status = 'Sold' then return new; end if;
  if tg_op = 'UPDATE' and old.status is distinct from 'Sold' then return new; end if;
  if is_pro(new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('animal-limit:' || new.user_id::text));
  select value into lim from app_limits where key = 'free_animals';
  select count(*) into n from animals where user_id = new.user_id and status <> 'Sold' and id <> new.id;
  if lim is not null and n >= lim then
    raise exception 'free_limit_reached: free accounts can have up to % animals (animals marked Sold do not count)', lim using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists free_animal_limit on animals;
create trigger free_animal_limit before insert or update of status on animals for each row execute function enforce_free_animal_limit();

-- Complimentary Pro for chosen accounts (the owner's, the reviewer's) is set by hand with last_event_type = 'MANUAL'
-- and no expiry; the revenuecat-webhook function never changes those rows. Example:
--   insert into subscriptions (user_id, entitlement, active, expires_at, product_id, store, last_event_type, last_event_at)
--   select id, 'pro', true, null, 'owner_account', 'PROMOTIONAL', 'MANUAL', now() from auth.users where email = '<email>'
--   on conflict (user_id) do update set active = true, expires_at = null, last_event_type = 'MANUAL';
