-- ABOUTME: Lets the server's service role read and write blocked_emails.
-- ABOUTME: Banning someone adds their email to this table from the server.
grant all on public.blocked_emails to service_role;
