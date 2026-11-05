-- Blocked emails can't come back by changing the email on another account
-- either. A requested address waits in email_change until it's confirmed,
-- then moves to email, so both are checked. Each is only checked when it
-- changes, so existing accounts aren't re-checked on unrelated updates.
create or replace function public.block_banned_emails()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.email is distinct from old.email)
    and exists (
      select 1 from public.blocked_emails b
      where b.email = public.normalize_email(new.email)
    ) then
    raise exception 'This email address cannot be used.';
  end if;
  if (tg_op = 'INSERT' or new.email_change is distinct from old.email_change)
    and exists (
      select 1 from public.blocked_emails b
      where b.email = public.normalize_email(new.email_change)
    ) then
    raise exception 'This email address cannot be used.';
  end if;
  return new;
end;
$$;

drop trigger block_banned_emails_before_insert on auth.users;

create trigger block_banned_emails
  before insert or update of email, email_change on auth.users
  for each row execute function public.block_banned_emails();
