-- Adds average_baseline (average of each athlete's first submitted total)
-- to platform_stats, so the "train like an engineer" pipeline on the
-- homepage — baseline -> ... -> current record — reflects real submissions
-- instead of one hardcoded example. CREATE OR REPLACE is safe here since
-- it only appends a column; existing ones are unchanged.
create or replace view public.platform_stats
with (security_invoker = true)
as
select
  (select count(*) from public.leaderboard) as athletes,
  (select count(*) from public.results) as attempts,
  coalesce((select max(total) from public.results where status <> 'rejected'), 0) as current_record,
  coalesce((select round(avg(total)) from public.leaderboard), 0) as average_score,
  coalesce((
    select round(avg(first_attempt.total))
    from (
      select distinct on (user_id) user_id, total
      from public.results
      where status <> 'rejected'
      order by user_id, submitted_at asc
    ) first_attempt
  ), 0) as average_baseline;
