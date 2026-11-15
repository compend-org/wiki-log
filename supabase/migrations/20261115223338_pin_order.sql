-- ABOUTME: Lets people pin any number of their logs and lists, in an order they choose.
-- ABOUTME: Each pin has a position; new pins go last, and move_pin moves one to another place.

drop trigger pins_limit on public.pins;
drop function public.limit_pins();

-- Positions are 1, 2, 3... per person, starting from the newest pin, the
-- order pins showed in until now
alter table public.pins add column position integer;

update public.pins
set position = ordered.pos
from (
  select id,
         row_number() over (partition by user_id order by pinned_at desc, id) as pos
  from public.pins
) ordered
where pins.id = ordered.id;

alter table public.pins alter column position set not null;

drop index public.pins_user_pinned_idx;
create index pins_user_position_idx on public.pins (user_id, position);

-- A new pin goes after the person's other pins
create function public.place_new_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.position := coalesce(
    (select max(position) from public.pins where user_id = new.user_id),
    0
  ) + 1;
  return new;
end;
$$;

create trigger pins_place
  before insert on public.pins
  for each row execute function public.place_new_pin();

create policy "users reorder their own pins"
  on public.pins for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Only the position can change, so a pin can't be pointed at someone else's
-- log or list
revoke update on public.pins from anon, authenticated;
grant update (position) on public.pins to authenticated;

-- Moves one of the caller's pins to a place among their pins, shifting the
-- ones in between. p_position is 1-based and clamped; positions come out
-- 1, 2, 3... Only rows whose position changes are written. A pin that isn't
-- the caller's is a no-op.
create function public.move_pin(p_pin uuid, p_position integer)
returns void
language sql
set search_path = ''
as $$
  with others as (
    select id,
           row_number() over (order by position, pinned_at, id) as rn
    from public.pins
    where user_id = (select auth.uid()) and id <> p_pin
  ),
  target as (
    select least(greatest(p_position, 1), (select count(*) from others) + 1) as pos
    where exists (
      select 1 from public.pins
      where id = p_pin and user_id = (select auth.uid())
    )
  ),
  wanted as (
    select others.id,
           case when others.rn >= target.pos then others.rn + 1 else others.rn end as pos
    from others, target
    union all
    select p_pin, target.pos from target
  )
  update public.pins
  set position = wanted.pos::integer
  from wanted
  where pins.id = wanted.id
    and pins.position is distinct from wanted.pos::integer;
$$;

revoke execute on function public.move_pin(uuid, integer) from public, anon;
grant execute on function public.move_pin(uuid, integer)
  to authenticated, service_role;

notify pgrst, 'reload schema';
