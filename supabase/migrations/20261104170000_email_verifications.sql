-- Who has proven they own their email address by following an emailed link.
-- auth.users.email_confirmed_at can't say this while the "Confirm email" setting
-- is off, because every sign-up is then confirmed automatically.
create table public.email_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

-- Written only by the server, when an emailed link is followed
alter table public.email_verifications enable row level security;

create policy "People can see their own email verification"
  on public.email_verifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.email_verifications to authenticated;
grant all on public.email_verifications to service_role;

-- Everyone confirmed so far followed a link
insert into public.email_verifications (user_id, verified_at)
select id, email_confirmed_at
from auth.users
where email_confirmed_at is not null;

-- People still waiting on a confirmation email can sign in and verify later.
-- Sign-in refuses an unconfirmed address, whatever the "Confirm email" setting says.
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null
  and email is not null;
