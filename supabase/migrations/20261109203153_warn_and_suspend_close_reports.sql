-- ABOUTME: Warning or suspending an account also closes the open reports about it as actioned, like a ban.
-- ABOUTME: The action's record lists the reports it closed. A new report puts the account back in the queue.

-- Closes every open report about an account as actioned and returns their ids
create function public.close_account_reports(p_user_id uuid)
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.reports set status = 'actioned'
    where reported_user_id = p_user_id and status = 'open'
    returning id
  )
  select coalesce(array_agg(id), '{}') from closed;
$$;

revoke execute on function public.close_account_reports(uuid) from public, anon, authenticated;

create or replace function public.admin_warn(
  p_user_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);

  insert into public.moderation_actions (admin_id, user_id, kind, reason, note, report_ids)
  values (
    (select auth.uid()), p_user_id, 'warn', p_reason, p_note,
    public.close_account_reports(p_user_id)
  );

  perform public.notify_moderation(
    p_user_id,
    format(
      'The moderators have warned you about %s. Further problems can lead to a suspension or a ban.',
      public.moderation_reason_text(p_reason)
    )
  );
end;
$$;

-- Stops someone posting, commenting, liking, sharing and following for a
-- number of days, and closes the open reports about them as actioned.
-- Suspending again replaces the end date.
create or replace function public.admin_suspend(
  p_user_id uuid,
  p_days integer,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action uuid := gen_random_uuid();
  v_until timestamptz := now() + make_interval(days => p_days);
begin
  perform public.assert_site_admin();
  perform public.assert_moderation_reason(p_reason);
  perform public.assert_moderatable(p_user_id);
  if p_days is null or p_days not between 1 and 365 then
    raise exception 'A suspension lasts 1 to 365 days';
  end if;

  insert into public.moderation_actions (
    id, admin_id, user_id, kind, reason, note, suspended_until, report_ids
  ) values (
    v_action, (select auth.uid()), p_user_id, 'suspend', p_reason, p_note,
    v_until, public.close_account_reports(p_user_id)
  );

  insert into public.account_restrictions (user_id, suspended_until, action_id)
  values (p_user_id, v_until, v_action)
  on conflict (user_id) do update
  set suspended_until = excluded.suspended_until,
      action_id = excluded.action_id;

  perform public.notify_moderation(
    p_user_id,
    format(
      'Your account is suspended until %s for %s. Until then you can''t post, comment, like, share or follow.',
      to_char(v_until at time zone 'UTC', 'FMMonth FMDD, YYYY'),
      public.moderation_reason_text(p_reason)
    )
  );
end;
$$;
