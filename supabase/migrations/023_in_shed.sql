-- "In shed": an entry (kind in_shed) marking an animal as going into a shed. No feeds are due from then until a shed
-- is logged after it. animal_status gains in_shed (the day it went in, or null) for the morning notification.
-- Safe to run again.

alter table events drop constraint if exists events_kind_check;
alter table events add constraint events_kind_check check (kind in ('feed', 'shed', 'weight', 'in_shed'));

-- security_invoker: the view runs with the reader's rights, so row-level security still limits it to their own animals.
create or replace view animal_status with (security_invoker = true) as
select a.id, a.user_id, a.name, a.species, a.sex, a.status, a.dob, a.feed_every, a.notes, a.created_at,
  (select max(e.on_date) from events e where e.animal_id = a.id and e.kind = 'feed') as last_feed,
  (select max(e.on_date) from events e where e.animal_id = a.id and e.kind = 'shed') as last_shed,
  (select e.grams from events e where e.animal_id = a.id and e.kind = 'weight' order by e.on_date desc limit 1) as last_weight,
  -- The latest In shed with no shed logged after it (same day: whichever was entered later).
  (select b.on_date from events b where b.animal_id = a.id and b.kind = 'in_shed'
     and not exists (select 1 from events s where s.animal_id = a.id and s.kind = 'shed' and (s.on_date, s.created_at) > (b.on_date, b.created_at))
   order by b.on_date desc, b.created_at desc limit 1) as in_shed
from animals a;
