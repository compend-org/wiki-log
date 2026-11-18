-- A pin can also be for a list. Exactly one of log_id and list_id is set.
alter table public.trending_pins drop constraint trending_pins_pkey;
alter table public.trending_pins alter column log_id drop not null;
alter table public.trending_pins
  add column list_id uuid references public.lists(id) on delete cascade;
alter table public.trending_pins
  add constraint trending_pins_one_post check (num_nonnulls(log_id, list_id) = 1);
create unique index trending_pins_log_idx on public.trending_pins (log_id);
create unique index trending_pins_list_idx on public.trending_pins (list_id);
