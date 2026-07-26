-- Atomic task/calendar mutations. Task-linked events remain one-off Planevo
-- blocks: recurring masters and recurrence exceptions deliberately cannot
-- carry task_id because their lifecycle needs explicit recurrence operations.

alter table public.calendar_events
  drop constraint if exists calendar_events_task_link_one_off,
  add constraint calendar_events_task_link_one_off check (
    task_id is null
    or (
      rrule is null
      and parent_event_id is null
      and recurrence_id is null
    )
  ) not valid;

-- Preserve legacy rows while reconciling them to the V1 invariant. Recurring
-- task links and all but the earliest live block are detached as ordinary
-- events with provenance instead of being deleted.
update public.calendar_events
set task_id = null,
    description_json = coalesce(description_json, '{}'::jsonb)
      || jsonb_build_object(
        'task_link',
        jsonb_build_object(
          'disposition', 'detached_invalid_recurrence',
          'detached_at', now()
        )
      ),
    updated_at = now()
where task_id is not null
  and (
    rrule is not null
    or parent_event_id is not null
    or recurrence_id is not null
  );

with ranked as (
  select
    id,
    row_number() over (
      partition by task_id
      order by starts_at, created_at, id
    ) as task_block_rank
  from public.calendar_events
  where task_id is not null
    and deleted_at is null
)
update public.calendar_events event
set task_id = null,
    description_json = coalesce(event.description_json, '{}'::jsonb)
      || jsonb_build_object(
        'task_link',
        jsonb_build_object(
          'disposition', 'detached_legacy_duplicate',
          'detached_at', now()
        )
      ),
    updated_at = now()
from ranked
where event.id = ranked.id
  and ranked.task_block_rank > 1;

update public.tasks task
set due_at = event.starts_at,
    updated_at = now()
from public.calendar_events event
where event.task_id = task.id
  and event.user_id = task.user_id
  and event.deleted_at is null;

alter table public.calendar_events
  validate constraint calendar_events_task_link_one_off;

alter table public.calendar_events
  drop constraint if exists calendar_events_task_id_fkey,
  add constraint calendar_events_task_id_fkey
    foreign key (task_id) references public.tasks (id) on delete restrict;

drop index if exists public.calendar_events_live_task_link_idx;
create unique index calendar_events_live_task_link_idx
  on public.calendar_events (task_id)
  where task_id is not null and deleted_at is null;

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
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
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

  -- A task has one live scheduled block. A retry with a fresh operation key
  -- returns that block instead of creating an ambiguous second due time.
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

  select id
  into v_calendar_id
  from public.calendars
  where user_id = p_owner_id
  order by is_default desc, created_at, id
  limit 1;
  if v_calendar_id is null then
    raise exception 'calendar not found' using errcode = 'P0001';
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

create or replace function public.move_task_linked_event(
  p_owner_id uuid,
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_task public.tasks;
  v_event public.calendar_events;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid scheduled time range' using errcode = '22007';
  end if;

  select task_id
  into v_task_id
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null;
  if v_task_id is null then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_task_id::text, 1703));

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null
  for update;
  if not found
    or v_event.task_id is distinct from v_task_id
    or v_event.source <> 'planevo'
    or v_event.rrule is not null
    or v_event.parent_event_id is not null
    or v_event.recurrence_id is not null
  then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  select *
  into v_task
  from public.tasks
  where id = v_task_id
    and user_id = p_owner_id
  for update;
  if not found then
    raise exception 'task not found' using errcode = '42501';
  end if;

  update public.calendar_events
  set starts_at = p_starts_at,
      ends_at = p_ends_at,
      starts_at_local = case
        when v_event.timezone is null then null
        else p_starts_at at time zone v_event.timezone
      end,
      ends_at_local = case
        when v_event.timezone is null then null
        else p_ends_at at time zone v_event.timezone
      end,
      duration_minutes = greatest(
        1,
        round(extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer
      ),
      updated_at = now()
  where id = v_event.id
    and user_id = p_owner_id
  returning * into v_event;

  update public.tasks
  set due_at = p_starts_at,
      updated_at = now()
  where id = v_task.id
    and user_id = p_owner_id;

  return v_event;
end;
$$;

create or replace function public.set_task_status_with_linked_events(
  p_owner_id uuid,
  p_task_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_linked_events jsonb;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status is null
    or p_status not in ('not_started', 'in_progress', 'in_review', 'done', 'cancelled')
  then
    raise exception 'invalid task status' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text, 1703));

  update public.tasks
  set status = p_status,
      completed_at = case when p_status = 'done' then now() else null end,
      updated_at = now()
  where id = p_task_id
    and user_id = p_owner_id
  returning * into v_task;
  if not found then
    raise exception 'task not found' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', event.id,
        'calendarId', event.calendar_id,
        'startsAt', event.starts_at,
        'endsAt', event.ends_at,
        'deletedAt', event.deleted_at
      )
      order by event.starts_at, event.id
    ),
    '[]'::jsonb
  )
  into v_linked_events
  from public.calendar_events event
  where event.task_id = v_task.id
    and event.user_id = p_owner_id
    and event.deleted_at is null;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'linkedEvents', v_linked_events
  );
end;
$$;

create or replace function public.complete_task_linked_event(
  p_owner_id uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_task public.tasks;
  v_event public.calendar_events;
  v_linked_events jsonb;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select task_id
  into v_task_id
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null;
  if v_task_id is null then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_task_id::text, 1703));

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null
  for update;
  if not found
    or v_event.task_id is distinct from v_task_id
    or v_event.source <> 'planevo'
    or v_event.rrule is not null
    or v_event.parent_event_id is not null
    or v_event.recurrence_id is not null
  then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  update public.tasks
  set status = 'done',
      completed_at = now(),
      updated_at = now()
  where id = v_task_id
    and user_id = p_owner_id
  returning * into v_task;
  if not found then
    raise exception 'task not found' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', event.id,
        'calendarId', event.calendar_id,
        'startsAt', event.starts_at,
        'endsAt', event.ends_at,
        'deletedAt', event.deleted_at
      )
      order by event.starts_at, event.id
    ),
    '[]'::jsonb
  )
  into v_linked_events
  from public.calendar_events event
  where event.task_id = v_task.id
    and event.user_id = p_owner_id
    and event.deleted_at is null;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'linkedEvents', v_linked_events
  );
end;
$$;

create or replace function public.unschedule_task_linked_event(
  p_owner_id uuid,
  p_event_id uuid
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_task public.tasks;
  v_event public.calendar_events;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select task_id
  into v_task_id
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null;
  if v_task_id is null then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_task_id::text, 1703));

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null
  for update;
  if not found
    or v_event.task_id is distinct from v_task_id
    or v_event.source <> 'planevo'
    or v_event.rrule is not null
    or v_event.parent_event_id is not null
    or v_event.recurrence_id is not null
  then
    raise exception 'task-linked event not found' using errcode = '42501';
  end if;

  select *
  into v_task
  from public.tasks
  where id = v_task_id
    and user_id = p_owner_id
  for update;
  if not found then
    raise exception 'task not found' using errcode = '42501';
  end if;

  update public.calendar_events
  set deleted_at = now(),
      updated_at = now()
  where id = v_event.id
    and user_id = p_owner_id
  returning * into v_event;

  update public.tasks
  set due_at = null,
      updated_at = now()
  where id = v_task.id
    and user_id = p_owner_id;

  return v_event;
end;
$$;

create or replace function public.link_task_to_event(
  p_owner_id uuid,
  p_event_id uuid,
  p_task_id uuid
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_event public.calendar_events;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
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
  where id = p_event_id
    and user_id = p_owner_id
    and deleted_at is null
  for update;
  if not found
    or v_event.source <> 'planevo'
    or v_event.rrule is not null
    or v_event.parent_event_id is not null
    or v_event.recurrence_id is not null
    or (
      v_event.task_id is not null
      and v_event.task_id is distinct from p_task_id
    )
  then
    raise exception 'eligible event not found' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.calendar_events other
    where other.task_id = p_task_id
      and other.user_id = p_owner_id
      and other.deleted_at is null
      and other.id <> v_event.id
  ) then
    raise exception 'task already scheduled' using errcode = '23505';
  end if;

  update public.calendar_events
  set task_id = v_task.id,
      updated_at = now()
  where id = v_event.id
    and user_id = p_owner_id
  returning * into v_event;

  update public.tasks
  set due_at = v_event.starts_at,
      updated_at = now()
  where id = v_task.id
    and user_id = p_owner_id;

  return v_event;
end;
$$;

-- The old two-argument RPC could silently orphan an event through the
-- task_id ON DELETE SET NULL foreign key. Replace it with an explicit choice.
drop function if exists public.delete_task_cascade(uuid, uuid);

create or replace function public.delete_task_cascade(
  p_owner_id uuid,
  p_task_id uuid,
  p_linked_event_action text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_linked_event_action is null
    or p_linked_event_action not in ('delete_linked_block', 'keep_linked_block')
  then
    raise exception 'linked event action is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text, 1703));

  select *
  into v_task
  from public.tasks
  where id = p_task_id
    and user_id = p_owner_id
  for update;
  if not found then
    return false;
  end if;

  if p_linked_event_action = 'delete_linked_block' then
    update public.calendar_events
    set task_id = null,
        deleted_at = coalesce(deleted_at, now()),
        description_json = coalesce(description_json, '{}'::jsonb)
          || jsonb_build_object(
            'task_link',
            jsonb_build_object(
              'disposition', 'deleted_with_task',
              'former_task_id', v_task.id,
              'detached_at', now()
            )
          ),
        updated_at = now()
    where task_id = v_task.id
      and user_id = p_owner_id;
  else
    update public.calendar_events
    set task_id = null,
        description_json = coalesce(description_json, '{}'::jsonb)
          || jsonb_build_object(
            'task_link',
            jsonb_build_object(
              'disposition', 'kept_after_task_delete',
              'former_task_id', v_task.id,
              'detached_at', now()
            )
          ),
        updated_at = now()
    where task_id = v_task.id
      and user_id = p_owner_id;
  end if;

  update public.file_sources source
  set reservation_expires_at = null,
      metadata_json = source.metadata_json || jsonb_build_object(
        'cleanup_required', false,
        'task_attachment_state', 'detached',
        'claimed_task_id', null
      )
  where source.user_id = p_owner_id
    and coalesce(source.metadata_json->>'source_kind', '') = 'task-attachment'
    and exists (
      select 1
      from public.file_links link
      where link.file_source_id = source.id
        and link.target_type = 'task'
        and link.target_id = v_task.id
    );

  delete from public.file_links
  where target_type = 'task'
    and target_id = v_task.id;

  delete from public.workspace_links
  where resource_type = 'task'
    and resource_id = v_task.id;

  delete from public.tasks
  where id = v_task.id
    and user_id = p_owner_id;

  return true;
end;
$$;

revoke all on function public.schedule_task_idempotent(
  uuid, uuid, uuid, text, timestamptz, timestamptz
) from public, anon;
revoke all on function public.move_task_linked_event(
  uuid, uuid, timestamptz, timestamptz
) from public, anon;
revoke all on function public.set_task_status_with_linked_events(
  uuid, uuid, text
) from public, anon;
revoke all on function public.complete_task_linked_event(
  uuid, uuid
) from public, anon;
revoke all on function public.unschedule_task_linked_event(
  uuid, uuid
) from public, anon;
revoke all on function public.link_task_to_event(
  uuid, uuid, uuid
) from public, anon;
revoke all on function public.delete_task_cascade(
  uuid, uuid, text
) from public, anon;

grant execute on function public.schedule_task_idempotent(
  uuid, uuid, uuid, text, timestamptz, timestamptz
), public.move_task_linked_event(
  uuid, uuid, timestamptz, timestamptz
), public.set_task_status_with_linked_events(
  uuid, uuid, text
), public.complete_task_linked_event(
  uuid, uuid
), public.unschedule_task_linked_event(
  uuid, uuid
), public.link_task_to_event(
  uuid, uuid, uuid
), public.delete_task_cascade(
  uuid, uuid, text
) to authenticated, service_role;
