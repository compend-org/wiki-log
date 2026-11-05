-- ABOUTME: Lets signed-in people file reports through the site's report form.
-- ABOUTME: Status and reported_user_id stay out of reach of the browser.
revoke all on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, details)
  on public.reports to authenticated;
grant all on public.reports to service_role;
