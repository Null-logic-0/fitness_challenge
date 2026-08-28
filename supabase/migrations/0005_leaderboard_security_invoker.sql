-- Fixes a Supabase Security Advisor finding: public.leaderboard was created
-- without security_invoker, so it ran with the view owner's privileges
-- instead of the querying user's, bypassing RLS on the underlying tables.
-- (platform_stats already had this set correctly in 0002/0003 — this view
-- was the one gap.) Practical impact here was low, since results/profiles
-- already have fully public select policies, but the view should still
-- enforce RLS itself rather than relying on that happening to be true.
create or replace view public.leaderboard
with (security_invoker = true)
as
select distinct on (r.user_id)
  r.user_id,
  p.username,
  p.display_name,
  p.country,
  p.category,
  r.id as result_id,
  r.pull_ups,
  r.dips,
  r.total,
  r.status,
  r.submitted_at
from public.results r
join public.profiles p on p.id = r.user_id
where r.status <> 'rejected'
order by r.user_id, r.total desc, r.submitted_at asc;
