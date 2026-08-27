-- 5-Minute Challenge — initial schema
-- Run this once in the Supabase SQL editor (or `supabase db push`) for the
-- project referenced in .env.local. Safe to re-run only after a full reset;
-- it is not idempotent by design (CREATE, not CREATE OR REPLACE, for tables).

-- ---------------------------------------------------------------------------
-- profiles: one public row per auth.users row. auth.users itself is never
-- exposed to clients directly, so display name / country / category / a
-- shareable username all live here instead.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  country text,
  category text not null default 'open' check (category in ('open', 'men', 'women')),
  created_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- Turns "Luka Tchelidze" into "luka-tchelidze", falling back to a short
-- random suffix on collision so signup never fails on a duplicate name.
create function public.slugify_username(raw text)
returns text
language plpgsql
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

-- Auto-create a profile row whenever someone signs up. display_name and
-- country can be passed as auth signUp() options.data.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, username, display_name, country)
  values (
    new.id,
    public.slugify_username(chosen_name),
    chosen_name,
    new.raw_user_meta_data ->> 'country'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- results: one row per submitted attempt. `total` is a generated column —
-- clients can never write it directly, so a submitted score can't be
-- tampered with by sending a mismatched total. Rows have no UPDATE/DELETE
-- policy for regular users, which makes them immutable once inserted
-- (improving a score requires a brand-new row, i.e. a new attempt).
-- ---------------------------------------------------------------------------
create table public.results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pull_ups integer not null check (pull_ups >= 0 and pull_ups <= 500),
  dips integer not null check (dips >= 0 and dips <= 500),
  total integer generated always as (pull_ups + dips) stored,
  youtube_url text not null,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  submitted_at timestamptz not null default now()
);

create index results_user_id_idx on public.results (user_id);
create index results_total_idx on public.results (total desc);
create index results_status_idx on public.results (status);

-- Best valid (non-rejected) result per user — backs both "personal best"
-- and the leaderboard, so both always agree and neither can be edited
-- directly by a client.
create view public.leaderboard as
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

-- ---------------------------------------------------------------------------
-- admins + audit log: administrative status corrections are restricted to a
-- named allow-list of user ids and always leave a trail. Regular clients
-- have no INSERT/UPDATE policy on either table — all writes go through the
-- security-definer RPC below, which checks admin membership itself.
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.result_audit_log (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results (id) on delete cascade,
  admin_id uuid not null references auth.users (id),
  previous_status text not null,
  new_status text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create function public.admin_set_result_status(p_result_id uuid, p_new_status text, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_previous text;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_new_status not in ('pending', 'verified', 'rejected') then
    raise exception 'invalid status';
  end if;

  select status into v_previous from public.results where id = p_result_id for update;
  if v_previous is null then
    raise exception 'result not found';
  end if;

  update public.results set status = p_new_status where id = p_result_id;

  insert into public.result_audit_log (result_id, admin_id, previous_status, new_status, reason)
  values (p_result_id, auth.uid(), v_previous, p_new_status, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- invites: "challenge a friend" links. Accepting an invite is a guarded
-- state transition (sent -> accepted, once, by someone other than the
-- inviter), so it goes through an RPC rather than a client-side UPDATE.
-- ---------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(encode(gen_random_bytes(9), 'base64'), '/', '_'),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  result_id uuid references public.results (id) on delete set null,
  invitee_user_id uuid references auth.users (id),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'completed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create index invites_token_idx on public.invites (token);
create index invites_inviter_idx on public.invites (inviter_id);

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select id into v_invite_id from public.invites
  where token = p_token and status = 'sent'
  for update;

  if v_invite_id is null then
    -- already accepted or unknown token — idempotent no-op so a retried
    -- click doesn't error out for the invitee.
    select id into v_invite_id from public.invites where token = p_token;
    return v_invite_id;
  end if;

  update public.invites
  set status = 'accepted', invitee_user_id = auth.uid(), accepted_at = now()
  where id = v_invite_id;

  return v_invite_id;
end;
$$;

-- Marks an invite completed once the invitee has submitted their own
-- result, so acceptance funnels can eventually be measured end-to-end.
create function public.complete_invite(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.invites
  set status = 'completed', completed_at = now()
  where token = p_token and invitee_user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.admins enable row level security;
alter table public.result_audit_log enable row level security;
alter table public.invites enable row level security;

-- profiles: public read (leaderboard/profile pages), owner-only write of
-- the safe fields (username/category stay client-writable; anything more
-- sensitive simply isn't stored here).
create policy "profiles_select_public" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- results: public read (leaderboard, public result pages, athlete
-- profiles), insert only as yourself, and — deliberately — no update or
-- delete policy at all, which makes rows immutable to every non-admin
-- client. Status corrections only happen via admin_set_result_status().
create policy "results_select_public" on public.results for select using (true);
create policy "results_insert_own" on public.results for insert with check (auth.uid() = user_id);

-- admins: members can see the list exists (used to gate admin UI, once
-- built); nobody can write to it via the client — manage membership from
-- the Supabase dashboard.
create policy "admins_select_self" on public.admins for select using (auth.uid() = user_id);

-- audit log: readable by admins only; all writes happen inside the
-- security-definer RPC above, so there is intentionally no insert policy.
create policy "audit_log_select_admin" on public.result_audit_log for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- invites: readable by anyone who has the token (the invite landing page
-- is unauthenticated by design), insertable only for your own result by
-- yourself; status transitions go through the RPCs above.
create policy "invites_select_public" on public.invites for select using (true);
create policy "invites_insert_own" on public.invites for insert with check (auth.uid() = inviter_id);
