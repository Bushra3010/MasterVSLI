-- Newer Supabase projects don't auto-grant table privileges to the API roles.
-- Signed-in users get table access (RLS policies still decide which rows);
-- anonymous visitors only get the public certificate-verification function.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.verify_letter(text) to anon;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
