-- ABOUTME: Lets admins close all of an account's open reports at once from the reports queue.
-- ABOUTME: Reporting a post again after its report was closed reopens it, so the account returns to the queue.

-- Marks an account's open reports as actioned or dismissed. Only reports filed
-- up to p_reported_before are closed, so one that arrives while the admin is
-- looking at the queue stays open.
create function public.admin_set_account_report_status(
  p_user_id uuid,
  p_status text,
  p_reported_before timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_admin();

  if p_status not in ('actioned', 'dismissed') then
    raise exception 'Unknown report status';
  end if;

  update public.reports
  set status = p_status
  where reported_user_id = p_user_id
    and status = 'open'
    and created_at <= p_reported_before;
end;
$$;

revoke execute on function public.admin_set_account_report_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_account_report_status(uuid, text, timestamptz) to authenticated;

-- Fills in who is being reported, and turns a repeat report of a post whose
-- report was closed into a fresh open report
create or replace function public.fill_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.reported_user_id := case new.target_type
    when 'log' then (select user_id from public.logs where id = new.target_id)
    when 'list' then (select user_id from public.lists where id = new.target_id)
    when 'comment' then (select user_id from public.comments where id = new.target_id)
    when 'list_comment' then (select user_id from public.list_comments where id = new.target_id)
  end;

  if new.reported_user_id is null then
    raise exception 'That post no longer exists';
  end if;
  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report your own post';
  end if;

  -- One report per person per post: reopen their closed one instead of
  -- inserting a second
  update public.reports
  set status = 'open',
      reason = new.reason,
      details = new.details,
      created_at = now()
  where reporter_id = new.reporter_id
    and target_type = new.target_type
    and target_id = new.target_id
    and status <> 'open';
  if found then
    return null;
  end if;

  return new;
end;
$$;
