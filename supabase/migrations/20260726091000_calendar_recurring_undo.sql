-- Restore the exact live row set captured before a recurring delete, move, or
-- resize. The changed row is the server-side eight-second expiry guard; newly
-- created split rows are retained as soft-deleted audit rows.

create or replace function public.restore_calendar_series_undo(
  p_owner_id uuid,
  p_master_event_id uuid,
  p_guard_event_id uuid,
  p_new_master_event_id uuid,
  p_event_rows jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guard_updated_at timestamptz;
  v_snapshot_count integer;
  v_snapshot_master_count integer;
  v_snapshot_distinct_ids integer;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_master_event_id is null
    or p_guard_event_id is null
    or jsonb_typeof(p_event_rows) <> 'array'
  then
    raise exception 'invalid recurring undo snapshot' using errcode = '22023';
  end if;

  v_snapshot_count := jsonb_array_length(p_event_rows);
  if v_snapshot_count < 1 or v_snapshot_count > 10000 then
    raise exception 'invalid recurring undo snapshot size' using errcode = '22023';
  end if;

  select
    count(*) filter (
      where restored.id = p_master_event_id
        and restored.parent_event_id is null
        and restored.rrule is not null
    ),
    count(distinct restored.id)
  into v_snapshot_master_count, v_snapshot_distinct_ids
  from jsonb_populate_recordset(
    null::public.calendar_events,
    p_event_rows
  ) as restored;

  if v_snapshot_master_count <> 1
    or v_snapshot_distinct_ids <> v_snapshot_count
    or exists (
      select 1
      from jsonb_populate_recordset(
        null::public.calendar_events,
        p_event_rows
      ) as restored
      where restored.user_id is distinct from p_owner_id
        or restored.deleted_at is not null
        or (
          restored.id is distinct from p_master_event_id
          and restored.parent_event_id is distinct from p_master_event_id
        )
    )
    or exists (
      select 1
      from jsonb_populate_recordset(
        null::public.calendar_events,
        p_event_rows
      ) as restored
      left join public.calendars calendar
        on calendar.id = restored.calendar_id
       and calendar.user_id = p_owner_id
      where calendar.id is null
    )
  then
    raise exception 'invalid recurring undo snapshot' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_master_event_id::text, 0)
  );

  select event.updated_at
  into v_guard_updated_at
  from public.calendar_events event
  where event.id = p_guard_event_id
    and event.user_id = p_owner_id
  for update;

  if not found
    or v_guard_updated_at < now() - interval '8 seconds'
  then
    raise exception 'undo expired' using errcode = '55000';
  end if;

  if p_new_master_event_id is not null then
    perform 1
    from public.calendar_events event
    where event.id = p_new_master_event_id
      and event.user_id = p_owner_id
      and event.parent_event_id is null
    for update;

    if not found then
      raise exception 'new recurring series not found' using errcode = '42501';
    end if;

    delete from public.workspace_links
    where resource_type = 'calendar_event'
      and resource_id = p_new_master_event_id;

    delete from public.file_links
    where target_type = 'calendar_event'
      and target_id = p_new_master_event_id;

    update public.calendar_events event
    set deleted_at = coalesce(event.deleted_at, now()),
        updated_at = now()
    where event.user_id = p_owner_id
      and event.parent_event_id = p_new_master_event_id;

    update public.calendar_events event
    set deleted_at = coalesce(event.deleted_at, now()),
        updated_at = now()
    where event.user_id = p_owner_id
      and event.id = p_new_master_event_id;
  end if;

  -- A "this event" mutation may have created a new exception. Keep that row
  -- for audit history, but retire it before restoring the prior live family.
  update public.calendar_events event
  set deleted_at = coalesce(event.deleted_at, now()),
      updated_at = now()
  where event.user_id = p_owner_id
    and (
      event.id = p_master_event_id
      or event.parent_event_id = p_master_event_id
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_event_rows) snapshot
      where (snapshot ->> 'id')::uuid = event.id
    );

  update public.calendar_events event
  set calendar_id = restored.calendar_id,
      user_id = restored.user_id,
      operation_key = restored.operation_key,
      title = restored.title,
      starts_at = restored.starts_at,
      ends_at = restored.ends_at,
      starts_at_local = restored.starts_at_local,
      ends_at_local = restored.ends_at_local,
      timezone = restored.timezone,
      duration_minutes = restored.duration_minutes,
      rrule = restored.rrule,
      recurrence_end = restored.recurrence_end,
      parent_event_id = restored.parent_event_id,
      recurrence_id = restored.recurrence_id,
      is_exception = restored.is_exception,
      is_cancelled = restored.is_cancelled,
      deleted_at = restored.deleted_at,
      color = restored.color,
      conference_url = restored.conference_url,
      all_day = restored.all_day,
      location = restored.location,
      description_json = restored.description_json,
      task_id = restored.task_id,
      google_event_id = restored.google_event_id,
      source = restored.source,
      created_at = restored.created_at,
      updated_at = restored.updated_at
  from jsonb_populate_recordset(
    null::public.calendar_events,
    p_event_rows
  ) as restored
  where event.id = p_master_event_id
    and event.user_id = p_owner_id
    and restored.id = p_master_event_id;

  insert into public.calendar_events
  select restored.*
  from jsonb_populate_recordset(
    null::public.calendar_events,
    p_event_rows
  ) as restored
  where restored.id <> p_master_event_id
  on conflict (id) do update
  set calendar_id = excluded.calendar_id,
      user_id = excluded.user_id,
      operation_key = excluded.operation_key,
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      starts_at_local = excluded.starts_at_local,
      ends_at_local = excluded.ends_at_local,
      timezone = excluded.timezone,
      duration_minutes = excluded.duration_minutes,
      rrule = excluded.rrule,
      recurrence_end = excluded.recurrence_end,
      parent_event_id = excluded.parent_event_id,
      recurrence_id = excluded.recurrence_id,
      is_exception = excluded.is_exception,
      is_cancelled = excluded.is_cancelled,
      deleted_at = excluded.deleted_at,
      color = excluded.color,
      conference_url = excluded.conference_url,
      all_day = excluded.all_day,
      location = excluded.location,
      description_json = excluded.description_json,
      task_id = excluded.task_id,
      google_event_id = excluded.google_event_id,
      source = excluded.source,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.restore_calendar_series_undo(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
) from public, anon;

grant execute on function public.restore_calendar_series_undo(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb
) to authenticated, service_role;
