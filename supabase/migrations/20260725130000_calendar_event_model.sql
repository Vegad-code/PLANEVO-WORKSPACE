-- Calendar event model foundation.
--
-- Legacy rows deliberately keep timezone null. Their existing starts_at and
-- ends_at values remain authoritative until a user explicitly edits them;
-- no live event is reinterpreted or moved by this migration.

alter table public.calendar_events
  add column if not exists starts_at_local timestamp,
  add column if not exists ends_at_local timestamp,
  add column if not exists timezone text,
  add column if not exists duration_minutes integer,
  add column if not exists rrule text,
  add column if not exists recurrence_end timestamptz,
  add column if not exists parent_event_id uuid
    references public.calendar_events (id) on delete cascade,
  add column if not exists recurrence_id timestamptz,
  add column if not exists is_exception boolean not null default false,
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists color text,
  add column if not exists conference_url text;

-- Keep the instant columns as the range-query cache. The partial index makes
-- every future read path's deleted_at filter efficient without replacing the
-- existing indexes while older application versions may still be running.
create index if not exists calendar_events_user_start_live_idx
  on public.calendar_events (user_id, starts_at)
  where deleted_at is null;

create index if not exists calendar_events_parent_idx
  on public.calendar_events (parent_event_id)
  where parent_event_id is not null;
