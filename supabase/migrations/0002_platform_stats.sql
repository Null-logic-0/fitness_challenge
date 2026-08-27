-- Platform-wide stats for the homepage's "the numbers" section. A single
-- aggregate view is far cheaper than shipping every result row to the
-- client just to count/average them there.
create view public.platform_stats
with (security_invoker = true)
as
select
  (select count(*) from public.leaderboard) as athletes,
  (select count(*) from public.results) as attempts,
  coalesce((select max(total) from public.results where status <> 'rejected'), 0) as current_record,
  coalesce((select round(avg(total)) from public.leaderboard), 0) as average_score;
