-- ABOUTME: Refuses sign-ups and email changes to throwaway email domains.
-- ABOUTME: The domain list is downloaded daily from the disposable-email-domains project.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.disposable_email_domains (
  domain text primary key  -- always lowercase
);

-- No policies: only the refresh job and the sign-up check read or change this table
alter table public.disposable_email_domains enable row level security;

-- True when the address is at a listed domain or any subdomain of one
create function public.is_disposable_email(e text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.disposable_email_domains d
    where split_part(lower(btrim(e)), '@', 2) = d.domain
       or split_part(lower(btrim(e)), '@', 2) like ('%.' || d.domain)
  );
$$;

-- Replaces the list with the latest from
-- https://github.com/disposable-email-domains/disposable-email-domains.
-- A failed or suspiciously short download keeps the current list.
create function public.refresh_disposable_email_domains()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  response extensions.http_response;
  domains text[];
begin
  response := extensions.http_get(
    'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf'
  );
  if response.status <> 200 then
    raise exception 'Disposable email list download failed with status %', response.status;
  end if;

  domains := array(
    select distinct lower(btrim(line))
    from regexp_split_to_table(response.content, '\n') as line
    where btrim(line) <> ''
  );
  if cardinality(domains) < 1000 then
    raise exception 'Disposable email list has only % domains', cardinality(domains);
  end if;

  delete from public.disposable_email_domains;
  insert into public.disposable_email_domains (domain)
  select unnest(domains);
end;
$$;

-- Only the database itself may trigger a download
revoke execute on function public.refresh_disposable_email_domains()
  from public, anon, authenticated;

select public.refresh_disposable_email_domains();

select cron.schedule(
  'refresh-disposable-email-domains',
  '17 4 * * *',
  'select public.refresh_disposable_email_domains()'
);

-- Checks the address at sign-up, and the pending address when someone asks
-- to change theirs. Existing accounts are left alone until their address changes.
create function public.block_disposable_emails()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.email is distinct from old.email)
     and public.is_disposable_email(new.email) then
    raise exception 'This email address cannot be used.';
  end if;
  if (tg_op = 'INSERT' or new.email_change is distinct from old.email_change)
     and public.is_disposable_email(new.email_change) then
    raise exception 'This email address cannot be used.';
  end if;
  return new;
end;
$$;

create trigger block_disposable_emails
  before insert or update of email, email_change on auth.users
  for each row execute function public.block_disposable_emails();
