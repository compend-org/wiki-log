create or replace function public.limit_log_rate()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (
    select count(*) from public.logs
    where user_id = new.user_id
      and logged_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'You are logging too fast. Please try again in a little while.';
  end if;
  return new;
end;
$$;