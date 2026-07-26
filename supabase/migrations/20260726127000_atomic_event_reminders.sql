-- Keep event mutations and browser reminder preferences in one transaction.

create or replace function public.create_calendar_event_with_reminder(
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
  p_reminder_offset_minutes integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid event time range' using errcode = '22007';
  end if;

  if p_description_json is not null
    and jsonb_typeof(p_description_json) <> 'object'
  then
    raise exception 'event description must be an object' using errcode = '22023';
  end if;

  perform 1
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and not exists (
      select 1
      from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  for update;
  if not found then
    raise exception 'writable calendar not found' using errcode = '42501';
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
    description_json
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
    coalesce(p_description_json, '{}'::jsonb)
  )
  returning id into v_event_id;

  if p_reminder_offset_minutes is not null then
    insert into public.event_reminders (
      event_id,
      user_id,
      offset_minutes,
      method
    )
    values (
      v_event_id,
      p_owner_id,
      p_reminder_offset_minutes,
      'browser'
    );
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.create_calendar_event_with_reminder(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  timestamp,
  timestamp,
  text,
  integer,
  text,
  timestamptz,
  text,
  jsonb,
  integer
) from public, anon;
grant execute on function public.create_calendar_event_with_reminder(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  timestamp,
  timestamp,
  text,
  integer,
  text,
  timestamptz,
  text,
  jsonb,
  integer
) to authenticated, service_role;

create or replace function public.update_calendar_event_with_reminder(
  p_owner_id uuid,
  p_event_id uuid,
  p_patch jsonb,
  p_reminder_specified boolean,
  p_reminder_offset_minutes integer
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.calendar_events;
  v_task public.tasks;
  v_task_id uuid;
  v_unknown_key text;
  v_calendar_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_timezone text;
  v_time_changed boolean;
begin
  if (select auth.role()) is distinct from 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then
    raise exception 'event patch must be an object' using errcode = '22023';
  end if;
  p_patch := coalesce(p_patch, '{}'::jsonb);

  select key
  into v_unknown_key
  from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) as key
  where key not in (
    'title',
    'starts_at',
    'ends_at',
    'starts_at_local',
    'ends_at_local',
    'timezone',
    'duration_minutes',
    'rrule',
    'recurrence_end',
    'calendar_id',
    'location',
    'description_json'
  )
  limit 1;
  if v_unknown_key is not null then
    raise exception 'unsupported event patch field: %', v_unknown_key
      using errcode = '22023';
  end if;

  if p_patch ? 'description_json'
    and p_patch -> 'description_json' <> 'null'::jsonb
    and jsonb_typeof(p_patch -> 'description_json') <> 'object'
  then
    raise exception 'event description must be an object' using errcode = '22023';
  end if;

  select event.task_id
  into v_task_id
  from public.calendar_events event
  where event.id = p_event_id
    and event.user_id = p_owner_id
    and event.source = 'planevo'
    and event.deleted_at is null;
  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  if v_task_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_task_id::text, 1703));
  end if;

  select *
  into v_event
  from public.calendar_events event
  where event.id = p_event_id
    and event.user_id = p_owner_id
    and event.source = 'planevo'
    and event.deleted_at is null
    and event.task_id is not distinct from v_task_id
  for update;
  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  v_calendar_id := case
    when p_patch ? 'calendar_id' then (p_patch ->> 'calendar_id')::uuid
    else v_event.calendar_id
  end;
  v_starts_at := case
    when p_patch ? 'starts_at' then (p_patch ->> 'starts_at')::timestamptz
    else v_event.starts_at
  end;
  v_ends_at := case
    when p_patch ? 'ends_at' then (p_patch ->> 'ends_at')::timestamptz
    else v_event.ends_at
  end;
  v_timezone := case
    when p_patch ? 'timezone' then p_patch ->> 'timezone'
    else v_event.timezone
  end;
  v_time_changed := p_patch ? 'starts_at'
    or p_patch ? 'ends_at'
    or p_patch ? 'timezone';

  if v_starts_at is null or v_ends_at is null or v_ends_at <= v_starts_at then
    raise exception 'invalid event time range' using errcode = '22007';
  end if;

  -- Lock the destination calendar so this check and the mutation have one
  -- serialization point with calendar ownership/connection changes.
  perform 1
  from public.calendars calendar
  where calendar.id = v_calendar_id
    and calendar.user_id = p_owner_id
    and not exists (
      select 1
      from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  for update;
  if not found then
    raise exception 'writable calendar not found' using errcode = '42501';
  end if;

  if v_task_id is not null then
    select *
    into v_task
    from public.tasks task
    where task.id = v_task_id
      and task.user_id = p_owner_id
    for update;
    if not found then
      raise exception 'linked task not found' using errcode = '42501';
    end if;
  end if;

  update public.calendar_events as event
  set
    title = case
      when p_patch ? 'title' then p_patch ->> 'title'
      else event.title
    end,
    starts_at = case
      when p_patch ? 'starts_at' then v_starts_at
      else event.starts_at
    end,
    ends_at = case
      when p_patch ? 'ends_at' then v_ends_at
      else event.ends_at
    end,
    starts_at_local = case
      when p_patch ? 'starts_at_local'
        then (p_patch ->> 'starts_at_local')::timestamp
      when v_time_changed and v_timezone is not null
        then v_starts_at at time zone v_timezone
      when v_time_changed then null
      else event.starts_at_local
    end,
    ends_at_local = case
      when p_patch ? 'ends_at_local'
        then (p_patch ->> 'ends_at_local')::timestamp
      when v_time_changed and v_timezone is not null
        then v_ends_at at time zone v_timezone
      when v_time_changed then null
      else event.ends_at_local
    end,
    timezone = case
      when p_patch ? 'timezone' then v_timezone
      else event.timezone
    end,
    duration_minutes = case
      when p_patch ? 'duration_minutes'
        then (p_patch ->> 'duration_minutes')::integer
      when v_time_changed
        then round(extract(epoch from (v_ends_at - v_starts_at)) / 60.0)::integer
      else event.duration_minutes
    end,
    rrule = case
      when p_patch ? 'rrule' then p_patch ->> 'rrule'
      else event.rrule
    end,
    recurrence_end = case
      when p_patch ? 'recurrence_end'
        then (p_patch ->> 'recurrence_end')::timestamptz
      else event.recurrence_end
    end,
    calendar_id = case
      when p_patch ? 'calendar_id' then v_calendar_id
      else event.calendar_id
    end,
    location = case
      when p_patch ? 'location' then p_patch ->> 'location'
      else event.location
    end,
    description_json = case
      when p_patch ? 'description_json'
        then coalesce(nullif(p_patch -> 'description_json', 'null'::jsonb), '{}'::jsonb)
      else event.description_json
    end,
    updated_at = now()
  where event.id = v_event.id
    and event.user_id = p_owner_id
  returning * into v_event;

  if v_task_id is not null and p_patch ? 'starts_at'
  then
    update public.tasks task
    set due_at = v_starts_at,
        updated_at = now()
    where task.id = v_task.id
      and task.user_id = p_owner_id;
    if not found then
      raise exception 'linked task not found' using errcode = '42501';
    end if;
  end if;

  if p_reminder_specified then
    if v_event.rrule is not null and p_reminder_offset_minutes is not null then
      raise exception 'recurring event reminders are not supported'
        using errcode = '0A000';
    end if;

    delete from public.event_reminders reminder
    where reminder.event_id = v_event.id
      and reminder.user_id = p_owner_id
      and reminder.method = 'browser';

    if p_reminder_offset_minutes is not null then
      insert into public.event_reminders (
        event_id,
        user_id,
        offset_minutes,
        method
      )
      values (
        v_event.id,
        p_owner_id,
        p_reminder_offset_minutes,
        'browser'
      );
    end if;
  end if;

  return v_event;
end;
$$;

revoke all on function public.update_calendar_event_with_reminder(
  uuid,
  uuid,
  jsonb,
  boolean,
  integer
) from public, anon;
grant execute on function public.update_calendar_event_with_reminder(
  uuid,
  uuid,
  jsonb,
  boolean,
  integer
) to authenticated, service_role;
