-- Calendar view engine, foundation slice.
--
-- Adds:
--   1. calendars.is_default        — a real default write target (replaces
--                                    "oldest calendar wins" in schedule_task_idempotent)
--   2. calendar_views              — a saved view is its own object: a name, a
--                                    preset, an 8-axis config, and which calendars
--                                    feed it. NOT a property of a calendar, so one
--                                    view can span several (a Planner view pulls
--                                    Work + Personal + task dues at once).
--
-- Availability is deliberately NOT scoped to a view's sources: conflict/free-busy
-- logic reads the whole event pool for the user. A view filters what is *drawn*,
-- never what the user is busy with.

-- ---------------------------------------------------------------------------
-- 1. Default calendar
-- ---------------------------------------------------------------------------

alter table public.calendars
  add column if not exists is_default boolean not null default false;

-- At most one default per user. Partial index, so non-defaults are unconstrained.
create unique index if not exists calendars_one_default_per_user
  on public.calendars (user_id) where is_default;

-- Backfill preserves today's behaviour exactly: the oldest calendar was already
-- the implicit write target, so promote it rather than silently moving anyone's
-- events to a different calendar.
update public.calendars c
set is_default = true
where not exists (
  select 1 from public.calendars d where d.user_id = c.user_id and d.is_default
)
and c.id = (
  select id from public.calendars o
  where o.user_id = c.user_id
  order by o.created_at, o.id
  limit 1
);

-- ---------------------------------------------------------------------------
-- 2. Saved views
-- ---------------------------------------------------------------------------

create table if not exists public.calendar_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Named starting point ('classic' | 'planner' | 'flow' | 'custom'). The full
  -- axis set lives in config; preset is what the UI shows and what a reset
  -- restores to.
  preset text not null default 'classic',
  -- The 8 axes (layout, timeAxis, dayCount, sidebarMode, groupingKey,
  -- colorSource, cardDensity, interactionSet). Validated in app code by the
  -- ViewConfig zod schema — jsonb here so adding an axis is not a migration.
  config jsonb not null default '{}'::jsonb,
  -- Which calendars feed this view. Empty array means "every visible calendar",
  -- which keeps a new view useful before the user has picked sources.
  -- ponytail: plain uuid[] rather than a join table — no FK integrity, so reads
  -- filter out ids of deleted calendars. Move to a join table only if stale-id
  -- accumulation actually shows up.
  source_calendar_ids uuid[] not null default '{}',
  include_task_dues boolean not null default true,
  is_default boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_views_user_position_idx
  on public.calendar_views (user_id, position);

create unique index if not exists calendar_views_one_default_per_user
  on public.calendar_views (user_id) where is_default;

alter table public.calendar_views enable row level security;

drop policy if exists calendar_views_owner on public.calendar_views;
create policy calendar_views_owner on public.calendar_views for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.calendar_views to authenticated;

-- No per-user seeding here. A user with zero rows falls back to the built-in
-- "Classic" preset in app code, so this migration stays O(1) and nobody's
-- calendar changes shape on deploy.

-- ---------------------------------------------------------------------------
-- 3. Point task scheduling at the real default calendar
-- ---------------------------------------------------------------------------

create or replace function public.schedule_task_idempotent(p_owner_id uuid,p_task_id uuid,p_operation_key uuid,p_title text,p_starts_at timestamptz,p_ends_at timestamptz)
returns public.calendar_events language plpgsql security invoker set search_path = '' as $$
declare v_event public.calendar_events; v_calendar uuid;
begin
  if not exists(select 1 from public.tasks where id=p_task_id and user_id=p_owner_id) then raise exception 'task not found' using errcode='42501'; end if;
  select * into v_event from public.calendar_events where user_id=p_owner_id and operation_key=p_operation_key;
  if found then return v_event; end if;
  -- Prefer the user's chosen default; fall back to oldest so a user who has not
  -- set one behaves exactly as before.
  select id into v_calendar from public.calendars
  where user_id=p_owner_id
  order by is_default desc, created_at, id
  limit 1;
  if v_calendar is null then raise exception 'calendar not found' using errcode='P0001'; end if;
  insert into public.calendar_events(calendar_id,user_id,title,starts_at,ends_at,task_id,operation_key)
  values(v_calendar,p_owner_id,p_title,p_starts_at,p_ends_at,p_task_id,p_operation_key) returning * into v_event;
  return v_event;
end; $$;
