-- Transactional recurrence operations and bounded recurrence-window lookup.
-- Depends on 20260725130000_calendar_event_model.sql.

create unique index if not exists calendar_events_parent_recurrence_uidx
  on public.calendar_events (parent_event_id, recurrence_id)
  where parent_event_id is not null and recurrence_id is not null;

create unique index if not exists calendar_events_id_user_uidx
  on public.calendar_events (id, user_id);

alter table public.calendar_events
  drop constraint if exists calendar_events_recurrence_shape,
  add constraint calendar_events_recurrence_shape check (
    (
      parent_event_id is null
      and recurrence_id is null
      and is_exception = false
      and is_cancelled = false
    )
    or
    (
      parent_event_id is not null
      and recurrence_id is not null
      and is_exception = true
      and rrule is null
      and recurrence_end is null
    )
  ) not valid;

alter table public.calendar_events
  validate constraint calendar_events_recurrence_shape;

alter table public.calendar_events
  drop constraint if exists calendar_events_recurring_master_shape,
  add constraint calendar_events_recurring_master_shape check (
    rrule is null
    or (
      parent_event_id is null
      and starts_at_local is not null
      and ends_at_local is not null
      and timezone is not null
      and btrim(timezone) <> ''
      and duration_minutes is not null
      and duration_minutes > 0
    )
  ) not valid;

alter table public.calendar_events
  validate constraint calendar_events_recurring_master_shape;

-- `COUNT` and `UNTIL` make an RRULE finite, but PostgreSQL cannot expand an
-- RRULE to discover its final occurrence. The application must therefore
-- persist the exclusive final occurrence identity in recurrence_end whenever
-- either token is present; null means the rule is deliberately unbounded.
alter table public.calendar_events
  drop constraint if exists calendar_events_bounded_rrule_end,
  add constraint calendar_events_bounded_rrule_end check (
    rrule is null
    or rrule !~* '(^|;)(COUNT|UNTIL)='
    or recurrence_end is not null
  ) not valid;

alter table public.calendar_events
  validate constraint calendar_events_bounded_rrule_end;

alter table public.calendar_events
  drop constraint if exists calendar_events_recurrence_end_after_start,
  add constraint calendar_events_recurrence_end_after_start check (
    rrule is null
    or recurrence_end is null
    -- Equality represents an empty old half after "this and following" is
    -- chosen on a series' first occurrence.
    or recurrence_end >= starts_at
  ) not valid;

alter table public.calendar_events
  validate constraint calendar_events_recurrence_end_after_start;

alter table public.calendar_events
  drop constraint if exists calendar_events_parent_same_owner_fkey,
  add constraint calendar_events_parent_same_owner_fkey
    foreign key (parent_event_id, user_id)
    references public.calendar_events (id, user_id)
    on delete cascade
    not valid;

alter table public.calendar_events
  validate constraint calendar_events_parent_same_owner_fkey;

create or replace function public.validate_calendar_event_recurrence_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.parent_event_id is not null and not exists (
    select 1
    from public.calendar_events parent
    where parent.id = new.parent_event_id
      and parent.user_id = new.user_id
      and parent.parent_event_id is null
      and parent.rrule is not null
      and parent.deleted_at is null
  ) then
    raise exception 'recurrence parent must be a live owned series master'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.parent_event_id is null
    and old.rrule is not null
    and new.rrule is null
    and exists (
      select 1
      from public.calendar_events child
      where child.parent_event_id = old.id
        and child.deleted_at is null
    )
  then
    raise exception 'cannot clear recurrence while live exceptions exist'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_events_validate_recurrence_parent
  on public.calendar_events;
create trigger calendar_events_validate_recurrence_parent
before insert or update of
  parent_event_id,
  user_id,
  rrule,
  deleted_at
on public.calendar_events
for each row execute function public.validate_calendar_event_recurrence_parent();

revoke all on function public.validate_calendar_event_recurrence_parent()
  from public, anon, authenticated;

-- Returns only series masters that can produce an occurrence in the requested
-- window, plus masters of concrete overrides moved into that window. The
-- duration-aware lower bound keeps overlap reads correct without transferring
-- every historical ended series. recurrence_end is the app-derived exclusive
-- boundary for finite COUNT/UNTIL rules, so SQL never has to parse RRULE.
create or replace function public.list_calendar_recurrence_masters(
  p_owner_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_overlaps boolean,
  p_workspace_event_ids uuid[] default null
)
returns setof public.calendar_events
language sql
stable
security invoker
set search_path = ''
as $$
  with moved_parent_ids as (
    select distinct exception.parent_event_id
    from public.calendar_events exception
    where exception.user_id = p_owner_id
      and exception.deleted_at is null
      and exception.parent_event_id is not null
      and exception.is_exception
      and not exception.is_cancelled
      and (
        (
          p_overlaps
          and exception.starts_at < p_window_end
          and exception.ends_at > p_window_start
        )
        or
        (
          not p_overlaps
          and exception.starts_at >= p_window_start
          and exception.starts_at < p_window_end
        )
      )
      and (
        p_workspace_event_ids is null
        or exception.id = any (p_workspace_event_ids)
        or exception.parent_event_id = any (p_workspace_event_ids)
      )
  )
  select master.*
  from public.calendar_events master
  where master.user_id = p_owner_id
    and master.deleted_at is null
    and master.parent_event_id is null
    and master.rrule is not null
    and not master.is_cancelled
    and (
      (
        master.starts_at < p_window_end
        and (
          master.recurrence_end is null
          or master.recurrence_end > (
            p_window_start
            - case
                when p_overlaps
                  then make_interval(mins => greatest(
                    coalesce(master.duration_minutes, 0),
                    0
                  ))
                else interval '0'
              end
          )
        )
        and (
          p_workspace_event_ids is null
          or master.id = any (p_workspace_event_ids)
        )
      )
      or master.id in (select parent_event_id from moved_parent_ids)
    )
  order by master.starts_at, master.id;
$$;

revoke all on function public.list_calendar_recurrence_masters(
  uuid,
  timestamptz,
  timestamptz,
  boolean,
  uuid[]
) from public, anon;
grant execute on function public.list_calendar_recurrence_masters(
  uuid,
  timestamptz,
  timestamptz,
  boolean,
  uuid[]
) to authenticated, service_role;

create or replace function public.upsert_calendar_event_exception(
  p_owner_id uuid,
  p_master_event_id uuid,
  p_calendar_id uuid,
  p_recurrence_id timestamptz,
  p_operation_key uuid,
  p_is_cancelled boolean,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_starts_at_local timestamp,
  p_ends_at_local timestamp,
  p_timezone text,
  p_duration_minutes integer,
  p_all_day boolean,
  p_location text,
  p_description_json jsonb,
  p_color text,
  p_conference_url text
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master public.calendar_events;
  v_exception public.calendar_events;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_operation_key is null then
    raise exception 'operation key is required' using errcode = '22023';
  end if;

  if p_calendar_id is null then
    raise exception 'calendar is required' using errcode = '22023';
  end if;

  select *
  into v_master
  from public.calendar_events
  where id = p_master_event_id
    and user_id = p_owner_id
  for update;

  if not found
    or v_master.deleted_at is not null
    or v_master.parent_event_id is not null
    or v_master.rrule is null
    or v_master.source <> 'planevo'
  then
    raise exception 'recurring event not found' using errcode = '42501';
  end if;

  if v_master.task_id is not null then
    raise exception 'task-linked recurrence is not supported'
      using errcode = '0A000';
  end if;

  perform 1
  from public.calendars
  where id = p_calendar_id
    and user_id = p_owner_id;
  if not found then
    raise exception 'calendar not found' using errcode = '42501';
  end if;

  select *
  into v_exception
  from public.calendar_events
  where user_id = p_owner_id
    and operation_key = p_operation_key;

  if found then
    if v_exception.parent_event_id <> p_master_event_id
      or v_exception.recurrence_id <> p_recurrence_id
      or v_exception.calendar_id <> p_calendar_id
    then
      raise exception 'operation key belongs to another event'
        using errcode = '23505';
    end if;
    return v_exception;
  end if;

  if p_ends_at <= p_starts_at
    or p_duration_minutes <= 0
    or p_timezone is null
    or btrim(p_timezone) = ''
  then
    raise exception 'invalid exception time range' using errcode = '22007';
  end if;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    operation_key,
    title,
    starts_at,
    ends_at,
    starts_at_local,
    ends_at_local,
    timezone,
    duration_minutes,
    parent_event_id,
    recurrence_id,
    is_exception,
    is_cancelled,
    color,
    conference_url,
    all_day,
    location,
    description_json,
    source
  )
  values (
    p_calendar_id,
    p_owner_id,
    p_operation_key,
    p_title,
    p_starts_at,
    p_ends_at,
    p_starts_at_local,
    p_ends_at_local,
    p_timezone,
    p_duration_minutes,
    p_master_event_id,
    p_recurrence_id,
    true,
    p_is_cancelled,
    p_color,
    p_conference_url,
    p_all_day,
    p_location,
    coalesce(p_description_json, '{}'::jsonb),
    v_master.source
  )
  on conflict (parent_event_id, recurrence_id)
    where parent_event_id is not null and recurrence_id is not null
  do update set
    calendar_id = excluded.calendar_id,
    operation_key = excluded.operation_key,
    title = excluded.title,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    starts_at_local = excluded.starts_at_local,
    ends_at_local = excluded.ends_at_local,
    timezone = excluded.timezone,
    duration_minutes = excluded.duration_minutes,
    is_cancelled = excluded.is_cancelled,
    color = excluded.color,
    conference_url = excluded.conference_url,
    all_day = excluded.all_day,
    location = excluded.location,
    description_json = excluded.description_json,
    deleted_at = null,
    updated_at = now()
  returning * into v_exception;

  return v_exception;
end;
$$;

revoke all on function public.upsert_calendar_event_exception(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  boolean,
  text,
  timestamptz,
  timestamptz,
  timestamp,
  timestamp,
  text,
  integer,
  boolean,
  text,
  jsonb,
  text,
  text
) from public, anon;
grant execute on function public.upsert_calendar_event_exception(
  uuid,
  uuid,
  uuid,
  timestamptz,
  uuid,
  boolean,
  text,
  timestamptz,
  timestamptz,
  timestamp,
  timestamp,
  text,
  integer,
  boolean,
  text,
  jsonb,
  text,
  text
) to authenticated, service_role;

-- recurrence_end is an exclusive occurrence-identity cutoff: an occurrence at
-- exactly recurrence_end belongs to the new series (or is deleted by truncate).
create or replace function public.truncate_calendar_event_series(
  p_owner_id uuid,
  p_master_event_id uuid,
  p_recurrence_id timestamptz
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master public.calendar_events;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_recurrence_id is null then
    raise exception 'recurrence cutoff is required' using errcode = '22023';
  end if;

  select *
  into v_master
  from public.calendar_events
  where id = p_master_event_id
    and user_id = p_owner_id
  for update;

  if not found
    or v_master.deleted_at is not null
    or v_master.parent_event_id is not null
    or v_master.rrule is null
    or p_recurrence_id < v_master.starts_at
  then
    raise exception 'recurring event not found' using errcode = '42501';
  end if;

  if v_master.recurrence_end = p_recurrence_id then
    return v_master;
  end if;

  if v_master.recurrence_end is not null
    and p_recurrence_id > v_master.recurrence_end
  then
    raise exception 'recurring event not found' using errcode = '42501';
  end if;

  update public.calendar_events
  set recurrence_end = p_recurrence_id,
      updated_at = now()
  where id = v_master.id
    and user_id = p_owner_id
  returning * into v_master;

  update public.calendar_events
  set deleted_at = now(),
      updated_at = now()
  where parent_event_id = v_master.id
    and user_id = p_owner_id
    and recurrence_id >= p_recurrence_id
    and deleted_at is null;

  return v_master;
end;
$$;

revoke all on function public.truncate_calendar_event_series(
  uuid,
  uuid,
  timestamptz
) from public, anon;
grant execute on function public.truncate_calendar_event_series(
  uuid,
  uuid,
  timestamptz
) to authenticated, service_role;

create or replace function public.split_calendar_event_series(
  p_owner_id uuid,
  p_master_event_id uuid,
  p_split_recurrence_id timestamptz,
  p_operation_key uuid,
  p_new_calendar_id uuid,
  p_new_title text,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz,
  p_new_starts_at_local timestamp,
  p_new_ends_at_local timestamp,
  p_new_timezone text,
  p_new_duration_minutes integer,
  p_new_rrule text,
  p_new_recurrence_end timestamptz,
  p_new_all_day boolean,
  p_new_location text,
  p_new_description_json jsonb,
  p_new_color text,
  p_new_conference_url text,
  p_exception_recurrence_id_map jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master public.calendar_events;
  v_new_master public.calendar_events;
  v_child_count integer;
  v_mapping_count integer;
  v_copied_count integer;
  v_retired_count integer;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_operation_key is null then
    raise exception 'operation key is required' using errcode = '22023';
  end if;

  if p_split_recurrence_id is null then
    raise exception 'split recurrence is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_master_event_id::text, 0));

  select *
  into v_master
  from public.calendar_events
  where id = p_master_event_id
    and user_id = p_owner_id
  for update;

  if not found
    or v_master.deleted_at is not null
    or v_master.parent_event_id is not null
    or v_master.rrule is null
    or v_master.source <> 'planevo'
    or v_master.task_id is not null
  then
    raise exception 'recurring event cannot be split' using errcode = '42501';
  end if;

  select *
  into v_new_master
  from public.calendar_events
  where user_id = p_owner_id
    and operation_key = p_operation_key;
  if found then
    if v_master.recurrence_end is distinct from p_split_recurrence_id
      or v_new_master.parent_event_id is not null
      or v_new_master.rrule is null
    then
      raise exception 'operation key belongs to another event'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'oldMasterId', v_master.id,
      'newMasterId', v_new_master.id,
      'splitRecurrenceId', p_split_recurrence_id
    );
  end if;

  if p_split_recurrence_id < v_master.starts_at
    or (
      v_master.recurrence_end is not null
      and p_split_recurrence_id >= v_master.recurrence_end
    )
  then
    raise exception 'split point is outside the live series'
      using errcode = '22023';
  end if;

  if p_new_ends_at <= p_new_starts_at
    or p_new_duration_minutes <= 0
    or p_new_timezone is null
    or btrim(p_new_timezone) = ''
    or p_new_rrule is null
    or btrim(p_new_rrule) = ''
    or (
      p_new_recurrence_end is not null
      and p_new_recurrence_end <= p_new_starts_at
    )
  then
    raise exception 'invalid split series payload' using errcode = '22007';
  end if;

  perform 1
  from public.calendars
  where id = p_new_calendar_id
    and user_id = p_owner_id;
  if not found then
    raise exception 'calendar not found' using errcode = '42501';
  end if;

  perform 1
  from public.calendar_events
  where parent_event_id = v_master.id
    and user_id = p_owner_id
    and recurrence_id >= p_split_recurrence_id
    and deleted_at is null
  for update;

  select count(*)
  into v_child_count
  from public.calendar_events
  where parent_event_id = v_master.id
    and user_id = p_owner_id
    and recurrence_id >= p_split_recurrence_id
    and deleted_at is null;

  if jsonb_typeof(coalesce(p_exception_recurrence_id_map, '[]'::jsonb)) <> 'array'
  then
    raise exception 'exception recurrence map must be an array'
      using errcode = '22023';
  end if;

  select count(*)
  into v_mapping_count
  from jsonb_to_recordset(
    coalesce(p_exception_recurrence_id_map, '[]'::jsonb)
  ) as mapping(
    "oldRecurrenceId" timestamptz,
    "newRecurrenceId" timestamptz
  );

  if v_mapping_count <> v_child_count
    or exists (
      select 1
      from public.calendar_events child
      where child.parent_event_id = v_master.id
        and child.user_id = p_owner_id
        and child.recurrence_id >= p_split_recurrence_id
        and child.deleted_at is null
        and not exists (
          select 1
          from jsonb_to_recordset(
            coalesce(p_exception_recurrence_id_map, '[]'::jsonb)
          ) as mapping(
            "oldRecurrenceId" timestamptz,
            "newRecurrenceId" timestamptz
          )
          where mapping."oldRecurrenceId" = child.recurrence_id
        )
    )
    or (
      select count(distinct mapping."newRecurrenceId")
      from jsonb_to_recordset(
        coalesce(p_exception_recurrence_id_map, '[]'::jsonb)
      ) as mapping(
        "oldRecurrenceId" timestamptz,
        "newRecurrenceId" timestamptz
      )
    ) <> v_mapping_count
  then
    raise exception 'exception recurrence map is stale or incomplete'
      using errcode = '40001';
  end if;

  update public.calendar_events
  set recurrence_end = p_split_recurrence_id,
      updated_at = now()
  where id = v_master.id
    and user_id = p_owner_id;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    operation_key,
    title,
    starts_at,
    ends_at,
    starts_at_local,
    ends_at_local,
    timezone,
    duration_minutes,
    rrule,
    recurrence_end,
    color,
    conference_url,
    all_day,
    location,
    description_json,
    source
  )
  values (
    p_new_calendar_id,
    p_owner_id,
    p_operation_key,
    p_new_title,
    p_new_starts_at,
    p_new_ends_at,
    p_new_starts_at_local,
    p_new_ends_at_local,
    p_new_timezone,
    p_new_duration_minutes,
    p_new_rrule,
    p_new_recurrence_end,
    p_new_color,
    p_new_conference_url,
    p_new_all_day,
    p_new_location,
    coalesce(p_new_description_json, '{}'::jsonb),
    v_master.source
  )
  returning * into v_new_master;

  -- Do not update parent_event_id/recurrence_id in place: two future
  -- occurrences can exchange identities, which transiently violates the
  -- partial unique index. Copy first under the already-held master/child locks,
  -- then retire the old exception rows in this same transaction.
  insert into public.calendar_events (
    id,
    calendar_id,
    user_id,
    operation_key,
    title,
    starts_at,
    ends_at,
    starts_at_local,
    ends_at_local,
    timezone,
    duration_minutes,
    parent_event_id,
    recurrence_id,
    is_exception,
    is_cancelled,
    color,
    conference_url,
    all_day,
    location,
    description_json,
    task_id,
    google_event_id,
    source
  )
  select
    gen_random_uuid(),
    v_new_master.calendar_id,
    p_owner_id,
    gen_random_uuid(),
    child.title,
    child.starts_at,
    child.ends_at,
    child.starts_at_local,
    child.ends_at_local,
    child.timezone,
    child.duration_minutes,
    v_new_master.id,
    mapping."newRecurrenceId",
    true,
    child.is_cancelled,
    child.color,
    child.conference_url,
    child.all_day,
    child.location,
    child.description_json,
    child.task_id,
    child.google_event_id,
    child.source
  from jsonb_to_recordset(
    coalesce(p_exception_recurrence_id_map, '[]'::jsonb)
  ) as mapping(
    "oldRecurrenceId" timestamptz,
    "newRecurrenceId" timestamptz
  )
  join public.calendar_events child
    on child.parent_event_id = v_master.id
   and child.user_id = p_owner_id
   and child.recurrence_id = mapping."oldRecurrenceId"
   and child.recurrence_id >= p_split_recurrence_id
   and child.deleted_at is null;

  get diagnostics v_copied_count = row_count;
  if v_copied_count <> v_child_count then
    raise exception 'exception copy changed during split'
      using errcode = '40001';
  end if;

  update public.calendar_events child
  set deleted_at = now(),
      updated_at = now()
  where child.parent_event_id = v_master.id
    and child.user_id = p_owner_id
    and child.recurrence_id >= p_split_recurrence_id
    and child.deleted_at is null;

  get diagnostics v_retired_count = row_count;
  if v_retired_count <> v_child_count then
    raise exception 'exception retirement changed during split'
      using errcode = '40001';
  end if;

  -- A split creates a second event, not a move: preserve the old master links
  -- and duplicate them for the new master. Both tables have natural uniqueness
  -- constraints, making retries safe without inventing cross-link op keys.
  insert into public.workspace_links (
    workspace_id,
    resource_type,
    resource_id,
    created_by
  )
  select
    link.workspace_id,
    'calendar_event',
    v_new_master.id,
    p_owner_id
  from public.workspace_links link
  where link.resource_type = 'calendar_event'
    and link.resource_id = v_master.id
  on conflict (workspace_id, resource_type, resource_id) do nothing;

  insert into public.file_links (
    file_source_id,
    target_type,
    target_id
  )
  select
    link.file_source_id,
    'calendar_event',
    v_new_master.id
  from public.file_links link
  join public.file_sources source
    on source.id = link.file_source_id
   and source.user_id = p_owner_id
  where link.target_type = 'calendar_event'
    and link.target_id = v_master.id
  on conflict (file_source_id, target_type, target_id) do nothing;

  return jsonb_build_object(
    'oldMasterId', v_master.id,
    'newMasterId', v_new_master.id,
    'splitRecurrenceId', p_split_recurrence_id
  );
end;
$$;

revoke all on function public.split_calendar_event_series(
  uuid,
  uuid,
  timestamptz,
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
  boolean,
  text,
  jsonb,
  text,
  text,
  jsonb
) from public, anon;
grant execute on function public.split_calendar_event_series(
  uuid,
  uuid,
  timestamptz,
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
  boolean,
  text,
  jsonb,
  text,
  text,
  jsonb
) to authenticated, service_role;
