-- Greptile follow-up: atomic all-day create + keep create RPC signature current.
-- The multi-calendar redesign already ran; this replaces the 15-arg create RPC
-- with a 16-arg version that accepts p_all_day so clients never leave orphaned
-- timed events when all-day creation fails on a second patch call.

drop function if exists public.create_calendar_event_with_color_and_reminder(
  uuid, uuid, text, timestamptz, timestamptz, timestamp, timestamp,
  text, integer, text, timestamptz, text, jsonb, text, integer
);

drop function if exists public.create_calendar_event_with_color_and_reminder(
  uuid, uuid, text, timestamptz, timestamptz, timestamp, timestamp,
  text, integer, text, timestamptz, text, jsonb, text, integer, boolean
);

create or replace function public.create_calendar_event_with_color_and_reminder(
  p_owner_id uuid,
  p_calendar_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_starts_at_local timestamp,
  p_ends_at_local timestamp,
  p_timezone text,
  p_duration_minutes integer,
  p_rrule text,
  p_recurrence_end timestamptz,
  p_location text,
  p_description_json jsonb,
  p_color text,
  p_reminder_offset_minutes integer,
  p_all_day boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_id uuid;
  target_color_mode text;
begin
  if (select auth.role()) is distinct from 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_starts_at is null
    or p_ends_at is null
    or p_ends_at <= p_starts_at
  then
    raise exception 'invalid event time range' using errcode = '22007';
  end if;

  select calendar.color_mode
  into target_color_mode
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  for update;
  if not found then
    raise exception 'writable calendar not found' using errcode = '42501';
  end if;

  if target_color_mode = 'required_per_event' and p_color is null then
    raise exception 'event color is required' using errcode = '23514';
  end if;
  if p_rrule is not null and p_reminder_offset_minutes is not null then
    raise exception 'recurring event reminders are not supported'
      using errcode = '0A000';
  end if;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    title,
    starts_at,
    ends_at,
    starts_at_local,
    ends_at_local,
    timezone,
    duration_minutes,
    rrule,
    recurrence_end,
    location,
    description_json,
    color,
    all_day
  )
  values (
    p_calendar_id,
    p_owner_id,
    p_title,
    p_starts_at,
    p_ends_at,
    p_starts_at_local,
    p_ends_at_local,
    p_timezone,
    p_duration_minutes,
    p_rrule,
    p_recurrence_end,
    p_location,
    coalesce(p_description_json, '{}'::jsonb),
    p_color,
    coalesce(p_all_day, false)
  )
  returning id into event_id;

  if p_reminder_offset_minutes is not null then
    insert into public.event_reminders (
      event_id,
      user_id,
      offset_minutes,
      method
    )
    values (
      event_id,
      p_owner_id,
      p_reminder_offset_minutes,
      'browser'
    );
  end if;
  return event_id;
end;
$$;

revoke all on function public.create_calendar_event_with_color_and_reminder(
  uuid, uuid, text, timestamptz, timestamptz, timestamp, timestamp,
  text, integer, text, timestamptz, text, jsonb, text, integer, boolean
) from public, anon;
grant execute on function public.create_calendar_event_with_color_and_reminder(
  uuid, uuid, text, timestamptz, timestamptz, timestamp, timestamp,
  text, integer, text, timestamptz, text, jsonb, text, integer, boolean
) to authenticated, service_role;
