-- Connected calendars are read-only to authenticated clients. External sync
-- writes use the service role after the app has verified connection ownership.

-- Calendar creation already uses millisecond-sort positions. Widen the original
-- integer column so manual, ICS, and Google calendars share that ordering safely.
alter table public.calendars
  alter column position type bigint using position::bigint;

drop policy if exists calendar_events_both_endpoints
  on public.calendar_events;
drop policy if exists calendar_events_owner
  on public.calendar_events;
drop policy if exists calendar_events_owner_select
  on public.calendar_events;
drop policy if exists calendar_events_owner_insert
  on public.calendar_events;
drop policy if exists calendar_events_owner_update
  on public.calendar_events;
drop policy if exists calendar_events_owner_delete
  on public.calendar_events;

create policy calendar_events_owner_select
  on public.calendar_events for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
    )
    and (
      task_id is null
      or exists (
        select 1
        from public.tasks task
        where task.id = task_id
          and task.user_id = (select auth.uid())
      )
    )
  );

create policy calendar_events_owner_insert
  on public.calendar_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and source = 'planevo'
    and external_connection_id is null
    and external_event_id is null
    and exists (
      select 1
      from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.calendar_connections connection
      where connection.calendar_id = calendar_id
        and connection.user_id = (select auth.uid())
    )
    and (
      task_id is null
      or exists (
        select 1
        from public.tasks task
        where task.id = task_id
          and task.user_id = (select auth.uid())
      )
    )
  );

create policy calendar_events_owner_update
  on public.calendar_events for update to authenticated
  using (
    user_id = (select auth.uid())
    and source = 'planevo'
  )
  with check (
    user_id = (select auth.uid())
    and source = 'planevo'
    and external_connection_id is null
    and external_event_id is null
    and exists (
      select 1
      from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.calendar_connections connection
      where connection.calendar_id = calendar_id
        and connection.user_id = (select auth.uid())
    )
    and (
      task_id is null
      or exists (
        select 1
        from public.tasks task
        where task.id = task_id
          and task.user_id = (select auth.uid())
      )
    )
  );

create policy calendar_events_owner_delete
  on public.calendar_events for delete to authenticated
  using (
    user_id = (select auth.uid())
    and source = 'planevo'
  );

revoke execute
  on function public.apply_external_calendar_sync(uuid, uuid, jsonb, boolean)
  from authenticated;
grant execute
  on function public.apply_external_calendar_sync(uuid, uuid, jsonb, boolean)
  to service_role;

-- Reminders intentionally cover only non-recurring Planevo events in V1.
delete from public.event_reminders reminder
using public.calendar_events event
where event.id = reminder.event_id
  and event.rrule is not null;

drop policy if exists event_reminders_owner on public.event_reminders;
create policy event_reminders_owner
  on public.event_reminders for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.calendar_events event
      where event.id = event_id
        and event.user_id = (select auth.uid())
        and event.source = 'planevo'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.calendar_events event
      where event.id = event_id
        and event.user_id = (select auth.uid())
        and event.source = 'planevo'
        and event.rrule is null
    )
  );

create or replace function public.remove_reminders_from_recurring_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rrule is not null then
    delete from public.event_reminders
    where event_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_remove_recurring_reminders
  on public.calendar_events;
create trigger calendar_events_remove_recurring_reminders
after insert or update of rrule on public.calendar_events
for each row
when (new.rrule is not null)
execute function public.remove_reminders_from_recurring_event();
