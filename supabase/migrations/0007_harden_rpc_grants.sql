-- Addresses Supabase Security Advisor findings. Nothing here was actually
-- exploitable — every affected function already self-checks auth.uid() or
-- is_admin() internally before doing anything — but least-privilege says
-- roles that could never succeed shouldn't be able to attempt the call at
-- all, and every function should have a pinned search_path regardless of
-- whether it's security definer.

-- function_search_path_mutable: slugify_username had no search_path set.
-- It already fully-qualifies public.profiles, so this wasn't exploitable,
-- but every function should pin search_path as a matter of course.
create or replace function public.slugify_username(raw text)
returns text
language plpgsql
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  base := lower(regexp_replace(coalesce(raw, 'athlete'), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then
    base := 'athlete';
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

-- anon/authenticated_security_definer_function_executable: these are
-- internal-only — handle_new_user runs solely via the on_auth_user_created
-- trigger, and is_admin() is only ever called from inside the other
-- SECURITY DEFINER functions below (which run as the definer, so revoking
-- client-facing EXECUTE here doesn't affect those internal calls).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_admin() from public;

-- accept_invite / complete_invite already require auth.uid() internally
-- (anon calling them is a guaranteed no-op), and the admin_* functions
-- already require is_admin() internally (a non-admin calling them is a
-- guaranteed no-op) — but there's no legitimate reason for anon to ever
-- call any of these, so drop the default PUBLIC grant and re-grant to
-- authenticated only.
revoke execute on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

revoke execute on function public.complete_invite(text) from public;
grant execute on function public.complete_invite(text) to authenticated;

revoke execute on function public.admin_create_result(uuid, integer, integer, text, text, text, text) from public;
grant execute on function public.admin_create_result(uuid, integer, integer, text, text, text, text) to authenticated;

revoke execute on function public.admin_update_result(uuid, integer, integer, text, text, text, text) from public;
grant execute on function public.admin_update_result(uuid, integer, integer, text, text, text, text) to authenticated;

revoke execute on function public.admin_delete_result(uuid, text) from public;
grant execute on function public.admin_delete_result(uuid, text) to authenticated;
