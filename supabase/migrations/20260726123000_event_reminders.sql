-- Browser reminder preferences for owned Planevo events.

create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  offset_minutes integer not null
    check (offset_minutes >= 0 and offset_minutes <= 10080),
  method text not null default 'browser'
    check (method in ('browser')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, method)
);

create index if not exists event_reminders_user_event_idx
  on public.event_reminders (user_id, event_id);

alter table public.event_reminders enable row level security;

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
    )
  );

grant select, insert, update, delete
  on public.event_reminders
  to authenticated;
