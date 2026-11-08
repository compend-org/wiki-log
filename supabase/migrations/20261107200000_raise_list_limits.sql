-- ABOUTME: Raises the caps on lists per user and items per list to 10,000 each.
-- ABOUTME: The caps stay only as a backstop against scripted abuse.
create or replace function public.limit_list_counts()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_table_name = 'lists' then
    if (select count(*) from public.lists where user_id = new.user_id) >= 10000 then
      raise exception 'You can have at most 10,000 lists.';
    end if;
  else
    if (select count(*) from public.list_items where list_id = new.list_id) >= 10000 then
      raise exception 'A list can hold at most 10,000 items.';
    end if;
  end if;
  return new;
end;
$$;
