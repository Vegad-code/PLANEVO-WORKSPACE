-- Restore a recently soft-deleted calendar event. Task-linked blocks restore
-- their task due date in the same transaction so Calendar and Tasks cannot
-- diverge during an undo.

create or replace function public.restore_calendar_event_undo(
  p_owner_id uuid,
  p_event_id uuid
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.calendar_events;
  v_task public.tasks;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
    and user_id = p_owner_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = '42501';
  end if;

  if v_event.deleted_at is null then
    return v_event;
  end if;

  if v_event.task_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(v_event.task_id::text, 1703)
    );

    select *
    into v_task
    from public.tasks
    where id = v_event.task_id
      and user_id = p_owner_id
    for update;

    if not found then
      raise exception 'linked task not found' using errcode = '42501';
    end if;
  end if;

  update public.calendar_events
  set deleted_at = null,
      updated_at = now()
  where id = v_event.id
    and user_id = p_owner_id
    and deleted_at is not null
  returning * into v_event;

  if v_event.task_id is not null then
    update public.tasks
    set due_at = v_event.starts_at,
        updated_at = now()
    where id = v_event.task_id
      and user_id = p_owner_id;
  end if;

  return v_event;
end;
$$;

revoke all on function public.restore_calendar_event_undo(uuid, uuid)
from public, anon;

grant execute on function public.restore_calendar_event_undo(uuid, uuid)
to authenticated, service_role;
