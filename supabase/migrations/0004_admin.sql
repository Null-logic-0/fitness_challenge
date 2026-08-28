-- Admin panel support: a simple is_admin flag (replacing the earlier
-- separate `admins` table) plus security-definer RPCs that are the *only*
-- way a result can be created on someone else's behalf, edited, or deleted
-- after submission. There is still no direct UPDATE/DELETE policy on
-- public.results for anyone — admins go through these functions, which run
-- with elevated privilege internally (security definer) and always write a
-- before/after snapshot to result_audit_log.

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- To make yourself an admin, run this once in the SQL editor:
--   update public.profiles set is_admin = true where username = 'your-username';

-- Fix a latent bug: results.user_id / invites.inviter_id / invites.invitee_user_id
-- were declared as FKs to auth.users, which PostgREST cannot use for embedding
-- (`profiles:user_id(...)`) since there's no declared relationship between
-- results/invites and public.profiles specifically — they just happen to
-- reference the same id independently. Re-pointing at public.profiles(id) is
-- safe (profiles.id is always identical to the auth.users id it was created
-- from) and is what makes the admin panel's athlete-name join, the invite
-- landing page, and the homepage's challenge preview actually work.
alter table public.results drop constraint if exists results_user_id_fkey;
alter table public.results add constraint results_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.invites drop constraint if exists invites_inviter_id_fkey;
alter table public.invites add constraint invites_inviter_id_fkey
  foreign key (inviter_id) references public.profiles (id) on delete cascade;

alter table public.invites drop constraint if exists invites_invitee_user_id_fkey;
alter table public.invites add constraint invites_invitee_user_id_fkey
  foreign key (invitee_user_id) references public.profiles (id);

-- result_audit_log's old policy (below) references public.admins, so it
-- must be dropped before admins is — otherwise the DROP TABLE fails with
-- "other objects depend on it". Rebuilt as a generic before/after trail;
-- result_id is nullable with ON DELETE SET NULL (not CASCADE) specifically
-- so that a delete's audit record survives the delete of the row it's
-- about — the `before` snapshot keeps the full deleted row regardless.
drop table if exists public.result_audit_log;

drop policy if exists "admins_select_self" on public.admins;
drop function if exists public.admin_set_result_status(uuid, text, text);
drop table if exists public.admins;
create table public.result_audit_log (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references public.results (id) on delete set null,
  admin_id uuid not null references auth.users (id),
  action text not null check (action in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  reason text not null,
  created_at timestamptz not null default now()
);

create index result_audit_log_result_id_idx on public.result_audit_log (result_id);

alter table public.result_audit_log enable row level security;

create policy "audit_log_select_admin" on public.result_audit_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.admin_create_result(
  p_user_id uuid,
  p_pull_ups integer,
  p_dips integer,
  p_youtube_url text,
  p_youtube_video_id text,
  p_status text,
  p_reason text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.results (user_id, pull_ups, dips, youtube_url, youtube_video_id, status)
  values (p_user_id, p_pull_ups, p_dips, p_youtube_url, p_youtube_video_id, coalesce(p_status, 'pending'))
  returning id into v_id;

  select to_jsonb(r) into v_after from public.results r where r.id = v_id;

  insert into public.result_audit_log (result_id, admin_id, action, before, after, reason)
  values (v_id, auth.uid(), 'create', null, v_after, p_reason);

  return v_id;
end;
$$;

create or replace function public.admin_update_result(
  p_result_id uuid,
  p_pull_ups integer,
  p_dips integer,
  p_youtube_url text,
  p_youtube_video_id text,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select to_jsonb(r) into v_before from public.results r where r.id = p_result_id;
  if v_before is null then
    raise exception 'result not found';
  end if;

  update public.results
  set pull_ups = coalesce(p_pull_ups, pull_ups),
      dips = coalesce(p_dips, dips),
      youtube_url = coalesce(p_youtube_url, youtube_url),
      youtube_video_id = coalesce(p_youtube_video_id, youtube_video_id),
      status = coalesce(p_status, status)
  where id = p_result_id;

  select to_jsonb(r) into v_after from public.results r where r.id = p_result_id;

  insert into public.result_audit_log (result_id, admin_id, action, before, after, reason)
  values (p_result_id, auth.uid(), 'update', v_before, v_after, p_reason);
end;
$$;

create or replace function public.admin_delete_result(p_result_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select to_jsonb(r) into v_before from public.results r where r.id = p_result_id;
  if v_before is null then
    raise exception 'result not found';
  end if;

  insert into public.result_audit_log (result_id, admin_id, action, before, after, reason)
  values (p_result_id, auth.uid(), 'delete', v_before, null, p_reason);

  delete from public.results where id = p_result_id;
end;
$$;
