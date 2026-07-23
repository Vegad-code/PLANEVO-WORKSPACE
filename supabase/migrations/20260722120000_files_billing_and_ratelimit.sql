-- Files hardening pass: a real per-user plan source for storage tiers, and a
-- Postgres fixed-window API rate limiter. Additive; apply via the hosted SQL
-- Editor (repo convention — never local Docker). Functions are security invoker.

-- 1. Per-user billing plan. Storage caps read from here; Stripe (Phase 8) writes
--    here. No row = free (resolveUserPlan defaults). Clients may read only their
--    own row; plan changes happen server/webhook side, never from the browser.
create table if not exists public.user_billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  updated_at timestamptz not null default now()
);

alter table public.user_billing enable row level security;

drop policy if exists user_billing_read_own on public.user_billing;
create policy user_billing_read_own on public.user_billing
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. Fixed-window rate limiter. One row per (user, route, window bucket); the RPC
--    atomically increments and reports whether the caller is still under the cap.
create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  route_key text not null,
  window_start bigint not null,
  count integer not null default 0,
  primary key (user_id, route_key, window_start)
);

alter table public.api_rate_limits enable row level security;

-- Security-invoker RPC runs as the caller, so it needs to touch its own rows.
drop policy if exists api_rate_limits_own on public.api_rate_limits;
create policy api_rate_limits_own on public.api_rate_limits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Returns true while the caller is within `p_limit` requests per `p_window_seconds`.
-- ponytail: one DB write per call — fine pre-beta; swap for Upstash/Redis if
-- request volume outgrows a per-request round trip. Stale window rows are
-- harmless; reap with `delete from api_rate_limits where window_start < ...`.
create or replace function public.check_rate_limit(
  p_owner_id uuid,
  p_route_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_window bigint;
  v_count integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;

  v_window := floor(extract(epoch from now()) / p_window_seconds)::bigint;

  insert into public.api_rate_limits (user_id, route_key, window_start, count)
  values (p_owner_id, p_route_key, v_window, 1)
  on conflict (user_id, route_key, window_start)
  do update set count = public.api_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(uuid, text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(uuid, text, integer, integer) to authenticated, service_role;
