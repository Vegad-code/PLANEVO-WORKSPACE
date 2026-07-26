-- Bounded external sync, retry fairness, reminder delivery, and writable
-- default-calendar invariants discovered during the final review.

alter table public.calendar_connections
  add column if not exists sync_window_end timestamptz,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists next_retry_at timestamptz
    not null default '-infinity',
  add column if not exists consecutive_failure_count integer not null default 0
    check (consecutive_failure_count >= 0);

create index if not exists calendar_connections_retry_due_idx
  on public.calendar_connections (
    is_enabled,
    next_retry_at,
    last_attempted_at
  );

-- Feed URLs are bearer credentials. New subscriptions store only application-
-- encrypted ciphertext, and authenticated clients can read operational metadata
-- without reading provider secrets or OAuth account rows.
create or replace function public.subscribe_ics_calendar(
  p_owner_id uuid,
  p_name text,
  p_color text,
  p_feed_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_calendar public.calendars;
  v_connection public.calendar_connections;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'calendar subscription requires service access'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null
     or length(btrim(p_name)) > 120
     or p_color not in ('slate', 'marigold', 'meadow', 'brick', 'ocean')
     or p_feed_url !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
     or length(p_feed_url) > 4000 then
    raise exception 'invalid calendar subscription' using errcode = '22023';
  end if;

  insert into public.calendars (
    user_id,
    name,
    color,
    is_visible,
    is_default,
    position
  )
  values (
    p_owner_id,
    btrim(p_name),
    p_color,
    true,
    false,
    coalesce((
      select max(existing.position) + 1
      from public.calendars existing
      where existing.user_id = p_owner_id
    ), 0)
  )
  returning * into v_calendar;

  insert into public.calendar_connections (
    user_id,
    calendar_id,
    provider,
    feed_url
  )
  values (
    p_owner_id,
    v_calendar.id,
    'ics',
    p_feed_url
  )
  returning * into v_connection;

  return jsonb_build_object(
    'calendar_id', v_calendar.id,
    'connection_id', v_connection.id
  );
end;
$$;

revoke all on function public.subscribe_ics_calendar(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.subscribe_ics_calendar(uuid, text, text, text)
  to service_role;

revoke all on public.calendar_accounts from authenticated;
revoke all on public.calendar_connections from authenticated;
grant select (
  id,
  user_id,
  calendar_id,
  provider,
  last_synced_at,
  last_sync_error,
  is_enabled,
  created_at,
  updated_at
) on public.calendar_connections to authenticated;

create or replace function public.get_due_browser_reminders(
  p_owner_id uuid,
  p_now timestamptz
)
returns table (
  reminder_id uuid,
  event_id uuid,
  title text,
  starts_at timestamptz,
  location text,
  offset_minutes integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    reminder.id,
    event.id,
    event.title,
    event.starts_at,
    event.location,
    reminder.offset_minutes
  from public.event_reminders reminder
  join public.calendar_events event
    on event.id = reminder.event_id
  where (
      (select auth.role()) = 'service_role'
      or p_owner_id = (select auth.uid())
    )
    and reminder.user_id = p_owner_id
    and reminder.method = 'browser'
    and event.user_id = p_owner_id
    and event.source = 'planevo'
    and event.deleted_at is null
    and event.rrule is null
    and event.starts_at
      - make_interval(mins => reminder.offset_minutes)
      between p_now - interval '5 minutes' and p_now + interval '30 seconds'
  order by
    event.starts_at - make_interval(mins => reminder.offset_minutes),
    reminder.id
  limit 500;
$$;

revoke all on function public.get_due_browser_reminders(uuid, timestamptz)
  from public, anon;
grant execute on function public.get_due_browser_reminders(uuid, timestamptz)
  to authenticated, service_role;

-- Creating an external connection can never promote its calendar to the
-- Planevo write target. Preserve an existing writable default when one exists.
create or replace function public.keep_connected_calendar_read_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.calendars
  set is_default = false
  where id = new.calendar_id
    and user_id = new.user_id
    and is_default;

  update public.calendars candidate
  set is_default = true
  where candidate.id = (
    select calendar.id
    from public.calendars calendar
    where calendar.user_id = new.user_id
      and not exists (
        select 1
        from public.calendar_connections connection
        where connection.calendar_id = calendar.id
      )
      and not exists (
        select 1
        from public.calendars current_default
        where current_default.user_id = new.user_id
          and current_default.is_default
      )
    order by calendar.created_at, calendar.id
    limit 1
  );

  return new;
end;
$$;

drop trigger if exists calendar_connections_keep_read_only
  on public.calendar_connections;
create trigger calendar_connections_keep_read_only
after insert on public.calendar_connections
for each row
execute function public.keep_connected_calendar_read_only();

update public.calendars calendar
set is_default = false
where calendar.is_default
  and exists (
    select 1
    from public.calendar_connections connection
    where connection.calendar_id = calendar.id
  );

with writable_ranked as (
  select
    calendar.id,
    row_number() over (
      partition by calendar.user_id
      order by calendar.created_at, calendar.id
    ) as writable_rank
  from public.calendars calendar
  where not exists (
    select 1
    from public.calendar_connections connection
    where connection.calendar_id = calendar.id
  )
  and not exists (
    select 1
    from public.calendars current_default
    where current_default.user_id = calendar.user_id
      and current_default.is_default
  )
)
update public.calendars calendar
set is_default = true
from writable_ranked
where calendar.id = writable_ranked.id
  and writable_ranked.writable_rank = 1;

create or replace function public.set_default_calendar(
  p_owner_id uuid,
  p_calendar_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'calendar owner mismatch' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('calendar-source:' || p_owner_id::text, 0)
  );

  if not exists (
    select 1
    from public.calendars calendar
    where calendar.id = p_calendar_id
      and calendar.user_id = p_owner_id
      and not exists (
        select 1
        from public.calendar_connections connection
        where connection.calendar_id = calendar.id
      )
  ) then
    raise exception 'writable calendar not found' using errcode = 'P0002';
  end if;

  update public.calendars
  set is_default = false
  where user_id = p_owner_id
    and is_default
    and id <> p_calendar_id;

  update public.calendars
  set is_default = true
  where id = p_calendar_id
    and user_id = p_owner_id;
end;
$$;

create or replace function public.schedule_task_idempotent(
  p_owner_id uuid,
  p_task_id uuid,
  p_operation_key uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_event public.calendar_events;
  v_calendar_id uuid;
  v_ends_at timestamptz;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_operation_key is null then
    raise exception 'operation key is required' using errcode = '22023';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid scheduled time range' using errcode = '22007';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text, 1703));

  select *
  into v_task
  from public.tasks
  where id = p_task_id
    and user_id = p_owner_id
  for update;
  if not found then
    raise exception 'task not found' using errcode = '42501';
  end if;

  select *
  into v_event
  from public.calendar_events
  where user_id = p_owner_id
    and operation_key = p_operation_key
  for update;
  if found then
    if v_event.task_id is distinct from p_task_id
      or v_event.deleted_at is not null
      or v_event.source <> 'planevo'
      or v_event.rrule is not null
      or v_event.parent_event_id is not null
      or v_event.recurrence_id is not null
    then
      raise exception 'operation key belongs to another event'
        using errcode = '23505';
    end if;

    update public.tasks
    set due_at = v_event.starts_at,
        updated_at = now()
    where id = v_task.id
      and user_id = p_owner_id;
    return v_event;
  end if;

  select *
  into v_event
  from public.calendar_events
  where task_id = p_task_id
    and user_id = p_owner_id
    and deleted_at is null
    and source = 'planevo'
    and rrule is null
    and parent_event_id is null
    and recurrence_id is null
  order by starts_at, id
  limit 1
  for update;
  if found then
    raise exception 'task already scheduled' using errcode = '23505';
  end if;

  select calendar.id
  into v_calendar_id
  from public.calendars calendar
  where calendar.user_id = p_owner_id
    and not exists (
      select 1
      from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  order by calendar.is_default desc, calendar.created_at, calendar.id
  limit 1;
  if v_calendar_id is null then
    raise exception 'writable calendar not found' using errcode = 'P0001';
  end if;

  v_ends_at := case
    when jsonb_typeof(v_task.description_json->'estimateMinutes') = 'number'
      and (v_task.description_json->>'estimateMinutes')::numeric % 1 = 0
      and (v_task.description_json->>'estimateMinutes')::numeric between 1 and 10080
    then p_starts_at
      + make_interval(
          mins => (v_task.description_json->>'estimateMinutes')::integer
        )
    else p_ends_at
  end;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    operation_key,
    title,
    starts_at,
    ends_at,
    task_id
  )
  values (
    v_calendar_id,
    p_owner_id,
    p_operation_key,
    v_task.title,
    p_starts_at,
    v_ends_at,
    p_task_id
  )
  returning * into v_event;

  update public.tasks
  set due_at = p_starts_at,
      updated_at = now()
  where id = v_task.id
    and user_id = p_owner_id;

  return v_event;
end;
$$;
