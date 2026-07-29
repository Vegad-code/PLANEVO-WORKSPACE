-- Multi-calendar redesign.
--
-- This migration is intentionally idempotent because the founder applies SQL
-- manually. It introduces a protected Main source, per-task calendar
-- assignment, bounded calendar trash, canonical Workspace calendar links, and
-- rewrites legacy saved-view embeds before removing calendar_views.

-- ---------------------------------------------------------------------------
-- Calendar identity, inclusion, color, and bounded trash
-- ---------------------------------------------------------------------------

alter table public.calendars
  add column if not exists is_main boolean not null default false,
  add column if not exists is_included_in_main boolean not null default true,
  add column if not exists color_mode text not null default 'inherit_override',
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendars'
      and column_name = 'is_visible'
  ) then
    execute 'update public.calendars
      set is_included_in_main = is_visible';
    execute 'alter table public.calendars drop column is_visible';
  end if;
end
$$;

update public.calendars
set color = case color
  when 'slate' then 'graphite'
  when 'marigold' then 'amber'
  when 'meadow' then 'basil'
  when 'brick' then 'tomato'
  when 'ocean' then 'blueberry'
  else color
end;

alter table public.calendars
  drop constraint if exists calendars_color_value_check,
  add constraint calendars_color_value_check check (
    color in (
      'lavender', 'sage', 'grape', 'flamingo',
      'banana', 'tangerine', 'peacock', 'graphite',
      'blueberry', 'basil', 'tomato', 'rose',
      'sky', 'teal', 'amber', 'plum'
    )
    or color ~ '^#[0-9A-F]{6}$'
  ) not valid,
  drop constraint if exists calendars_color_mode_check,
  add constraint calendars_color_mode_check check (
    color_mode in ('inherit_override', 'required_per_event')
  ) not valid,
  drop constraint if exists calendars_trash_window_check,
  add constraint calendars_trash_window_check check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after is not null)
  ) not valid;

alter table public.calendars
  validate constraint calendars_color_value_check,
  validate constraint calendars_color_mode_check,
  validate constraint calendars_trash_window_check;

alter table public.calendar_events
  drop constraint if exists calendar_events_color_value_check,
  add constraint calendar_events_color_value_check check (
    color is null
    or color in (
      'lavender', 'sage', 'grape', 'flamingo',
      'banana', 'tangerine', 'peacock', 'graphite',
      'blueberry', 'basil', 'tomato', 'rose',
      'sky', 'teal', 'amber', 'plum'
    )
    or color ~ '^#[0-9A-F]{6}$'
  ) not valid;

update public.calendar_events
set color = case color
  when 'slate' then 'graphite'
  when 'marigold' then 'amber'
  when 'meadow' then 'basil'
  when 'brick' then 'tomato'
  when 'ocean' then 'blueberry'
  -- Keep palette keys intact on re-run; only normalize custom hex casing.
  else case
    when color ~ '^#[0-9a-fA-F]{6}$' then upper(color)
    else color
  end
end
where color is not null;

alter table public.calendar_events
  validate constraint calendar_events_color_value_check;

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

create or replace function public.calendar_event_color_mode_is_valid()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.color is null and exists (
    select 1 from public.calendars calendar
    where calendar.id = new.calendar_id
      and calendar.user_id = new.user_id
      and calendar.color_mode = 'required_per_event'
  ) then
    raise exception 'event color is required' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_event_color_mode_is_valid
  on public.calendar_events;
create trigger calendar_event_color_mode_is_valid
before insert or update of calendar_id, color on public.calendar_events
for each row execute function public.calendar_event_color_mode_is_valid();

-- Reuse the seeded My Calendar when it is unambiguous. Users who only have
-- custom calendars receive a new Main row; no custom source is reclassified.
with candidate_counts as (
  select calendar.user_id, count(*) as candidate_count
  from public.calendars calendar
  where lower(btrim(calendar.name)) = 'my calendar'
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
    and calendar.created_at = (
      select min(first_calendar.created_at)
      from public.calendars first_calendar
      where first_calendar.user_id = calendar.user_id
        and first_calendar.deleted_at is null
        and not exists (
          select 1 from public.calendar_connections first_connection
          where first_connection.calendar_id = first_calendar.id
        )
    )
    and not exists (
      select 1 from public.calendars existing
      where existing.user_id = calendar.user_id and existing.is_main
    )
  group by calendar.user_id
),
candidates as (
  select calendar.id
  from public.calendars calendar
  join candidate_counts counts
    on counts.user_id = calendar.user_id
   and counts.candidate_count = 1
  where lower(btrim(calendar.name)) = 'my calendar'
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
    and calendar.created_at = (
      select min(first_calendar.created_at)
      from public.calendars first_calendar
      where first_calendar.user_id = calendar.user_id
        and first_calendar.deleted_at is null
        and not exists (
          select 1 from public.calendar_connections first_connection
          where first_connection.calendar_id = first_calendar.id
        )
    )
)
update public.calendars calendar
set is_main = true,
    name = 'Main',
    is_included_in_main = true
from candidates
where calendar.id = candidates.id;

insert into public.calendars (
  user_id,
  name,
  color,
  color_mode,
  is_main,
  is_included_in_main,
  is_default,
  position
)
select
  owner.user_id,
  'Main',
  'graphite',
  'inherit_override',
  true,
  true,
  not exists (
    select 1 from public.calendars candidate
    where candidate.user_id = owner.user_id and candidate.is_default
  ),
  -1
from (
  select id as user_id from auth.users
  union
  select user_id from public.calendars
  union
  select user_id from public.tasks
) owner
where not exists (
  select 1 from public.calendars main
  where main.user_id = owner.user_id and main.is_main
);

update public.calendars
set name = 'Main',
    is_included_in_main = true,
    deleted_at = null,
    purge_after = null
where is_main;

create unique index if not exists calendars_one_main_per_user
  on public.calendars (user_id) where is_main;
create index if not exists calendars_main_inclusion_idx
  on public.calendars (user_id, is_included_in_main)
  where deleted_at is null;
create index if not exists calendars_purge_after_idx
  on public.calendars (purge_after)
  where purge_after is not null;

create or replace function public.calendar_main_is_protected()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.is_main and (
    new.is_main is distinct from true
    or new.name is distinct from 'Main'
    or new.is_included_in_main is distinct from true
    or new.deleted_at is not null
    or new.purge_after is not null
  ) then
    raise exception 'Main calendar is protected' using errcode = '22023';
  end if;
  if new.is_main then
    new.name := 'Main';
    new.is_included_in_main := true;
    new.deleted_at := null;
    new.purge_after := null;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_main_is_protected on public.calendars;
create trigger calendar_main_is_protected
before update on public.calendars
for each row execute function public.calendar_main_is_protected();

create or replace function public.update_calendar_preferences(
  p_owner_id uuid,
  p_calendar_id uuid,
  p_name text,
  p_color text,
  p_color_mode text
)
returns public.calendars
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.calendars;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'calendar owner mismatch' using errcode = '42501';
  end if;

  select *
  into target
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and calendar.deleted_at is null
  for update;
  if not found then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'calendar name is required' using errcode = '22023';
  end if;
  if target.is_main and btrim(p_name) <> 'Main' then
    raise exception 'Main calendar is protected' using errcode = '22023';
  end if;

  if p_color_mode = 'required_per_event' then
    update public.calendar_events
    set color = p_color,
        updated_at = now()
    where calendar_id = p_calendar_id
      and user_id = p_owner_id
      and color is null;
  end if;

  update public.calendars
  set name = btrim(p_name),
      color = p_color,
      color_mode = p_color_mode
  where id = p_calendar_id
    and user_id = p_owner_id
  returning * into target;
  return target;
end;
$$;

revoke all on function public.update_calendar_preferences(
  uuid, uuid, text, text, text
) from public, anon;
grant execute on function public.update_calendar_preferences(
  uuid, uuid, text, text, text
) to authenticated, service_role;

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
      and calendar.deleted_at is null
      and not exists (
        select 1
        from public.calendar_connections connection
        where connection.calendar_id = calendar.id
      )
  ) then
    raise exception 'writable calendar not found' using errcode = 'P0002';
  end if;

  update public.calendars
  set is_default = (id = p_calendar_id)
  where user_id = p_owner_id
    and deleted_at is null
    and (
      is_default
      or id = p_calendar_id
    );
end;
$$;

create or replace function public.create_user_products(
  p_user_id uuid,
  p_seed jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  main_calendar_id uuid;
  task_el jsonb;
  new_task_id uuid;
  task_ids uuid[] := array[]::uuid[];
  pos numeric := 0;
  products_created boolean := false;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_user_id
  then
    raise exception 'user id does not match the mutation actor'
      using errcode = '42501';
  end if;

  select calendar.id
  into main_calendar_id
  from public.calendars calendar
  where calendar.user_id = p_user_id and calendar.is_main
  limit 1;

  if main_calendar_id is null then
    insert into public.calendars (
      user_id,
      name,
      color,
      is_main,
      is_included_in_main,
      is_default,
      position
    )
    values (
      p_user_id,
      'Main',
      'graphite',
      true,
      true,
      not exists (
        select 1 from public.calendars calendar
        where calendar.user_id = p_user_id and calendar.is_default
      ),
      -1
    )
    returning id into main_calendar_id;
    products_created := true;
  end if;

  if not exists (
    select 1 from public.tasks task where task.user_id = p_user_id
  ) then
    for task_el in
      select * from jsonb_array_elements(
        coalesce(p_seed -> 'starterTasks', '[]'::jsonb)
      )
    loop
      insert into public.tasks (user_id, title, status, position)
      values (
        p_user_id,
        coalesce(nullif(btrim(task_el ->> 'title'), ''), 'Untitled'),
        coalesce(
          nullif(btrim(task_el ->> 'status'), ''),
          'not_started'
        ),
        pos
      )
      returning id into new_task_id;
      task_ids := array_append(task_ids, new_task_id);
      pos := pos + 1;
    end loop;
    products_created := true;
  else
    select coalesce(
      array_agg(task.id order by task.position, task.id),
      array[]::uuid[]
    )
    into task_ids
    from public.tasks task
    where task.user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'calendar_id', main_calendar_id,
    'task_ids', to_jsonb(task_ids),
    'created', products_created
  );
end;
$$;

drop policy if exists calendars_owner on public.calendars;
drop policy if exists calendars_owner_select on public.calendars;
drop policy if exists calendars_owner_insert on public.calendars;
drop policy if exists calendars_owner_update on public.calendars;
drop policy if exists calendars_owner_delete on public.calendars;

create policy calendars_owner_select
  on public.calendars for select to authenticated
  using (user_id = (select auth.uid()));
create policy calendars_owner_insert
  on public.calendars for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      not is_main
      or (
        is_main
        and name = 'Main'
        and is_included_in_main
        and deleted_at is null
        and purge_after is null
      )
    )
  );
create policy calendars_owner_update
  on public.calendars for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy calendars_owner_delete
  on public.calendars for delete to authenticated
  using (user_id = (select auth.uid()) and not is_main);

-- ---------------------------------------------------------------------------
-- Every task belongs to exactly one calendar, whether scheduled or not.
-- ---------------------------------------------------------------------------

create table if not exists public.task_calendar_assignments (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_calendar_assignments_calendar_idx
  on public.task_calendar_assignments (calendar_id, task_id);
create index if not exists task_calendar_assignments_owner_idx
  on public.task_calendar_assignments (user_id, calendar_id);

insert into public.task_calendar_assignments (task_id, calendar_id, user_id)
select
  task.id,
  coalesce(
    (
      select event.calendar_id
      from public.calendar_events event
      where event.task_id = task.id
        and event.user_id = task.user_id
        and event.deleted_at is null
        and event.source = 'planevo'
        and not exists (
          select 1 from public.calendar_connections event_connection
          where event_connection.calendar_id = event.calendar_id
        )
      order by event.created_at, event.id
      limit 1
    ),
    (
      select calendar.id
      from public.calendars calendar
      where calendar.user_id = task.user_id
        and calendar.deleted_at is null
        and not exists (
          select 1 from public.calendar_connections connection
          where connection.calendar_id = calendar.id
        )
      order by calendar.is_default desc, calendar.is_main desc,
        calendar.created_at, calendar.id
      limit 1
    )
  ),
  task.user_id
from public.tasks task
where exists (
  select 1 from public.calendars calendar
  where calendar.user_id = task.user_id and calendar.deleted_at is null
)
on conflict (task_id) do nothing;

alter table public.task_calendar_assignments enable row level security;

drop policy if exists task_calendar_assignments_owner_select
  on public.task_calendar_assignments;
drop policy if exists task_calendar_assignments_owner_insert
  on public.task_calendar_assignments;
drop policy if exists task_calendar_assignments_owner_update
  on public.task_calendar_assignments;
drop policy if exists task_calendar_assignments_owner_delete
  on public.task_calendar_assignments;

create policy task_calendar_assignments_owner_select
  on public.task_calendar_assignments for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks task
      where task.id = task_id and task.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
    )
  );
create policy task_calendar_assignments_owner_insert
  on public.task_calendar_assignments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks task
      where task.id = task_id and task.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
        and calendar.deleted_at is null
        and not exists (
          select 1 from public.calendar_connections connection
          where connection.calendar_id = calendar.id
        )
    )
  );
create policy task_calendar_assignments_owner_update
  on public.task_calendar_assignments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.calendars calendar
      where calendar.id = calendar_id
        and calendar.user_id = (select auth.uid())
        and calendar.deleted_at is null
        and not exists (
          select 1 from public.calendar_connections connection
          where connection.calendar_id = calendar.id
        )
    )
  );
create policy task_calendar_assignments_owner_delete
  on public.task_calendar_assignments for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.task_calendar_assignments to authenticated, service_role;

create or replace function public.assign_new_task_to_default_calendar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_calendar_id uuid;
begin
  select calendar.id
  into target_calendar_id
  from public.calendars calendar
  where calendar.user_id = new.user_id
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  order by calendar.is_default desc, calendar.is_main desc,
    calendar.created_at, calendar.id
  limit 1;

  if target_calendar_id is null then
    raise exception 'writable calendar not found' using errcode = 'P0001';
  end if;

  insert into public.task_calendar_assignments (
    task_id, calendar_id, user_id
  )
  values (new.id, target_calendar_id, new.user_id)
  on conflict (task_id) do nothing;
  return new;
end;
$$;

drop trigger if exists assign_new_task_to_default_calendar on public.tasks;
create trigger assign_new_task_to_default_calendar
after insert on public.tasks
for each row execute function public.assign_new_task_to_default_calendar();

create or replace function public.calendar_task_assignment_follows_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.task_id is null
    or new.source <> 'planevo'
    or new.deleted_at is not null
    or new.calendar_id is not distinct from old.calendar_id
  then
    return new;
  end if;

  insert into public.task_calendar_assignments (
    task_id, calendar_id, user_id, updated_at
  )
  values (new.task_id, new.calendar_id, new.user_id, now())
  on conflict (task_id) do update
  set calendar_id = excluded.calendar_id,
      updated_at = now()
  where public.task_calendar_assignments.user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists calendar_task_assignment_follows_event
  on public.calendar_events;
create trigger calendar_task_assignment_follows_event
after update of calendar_id on public.calendar_events
for each row execute function public.calendar_task_assignment_follows_event();

create or replace function public.reassign_task_calendar(
  p_owner_id uuid,
  p_task_id uuid,
  p_calendar_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_color text;
  target_color_mode text;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.tasks task
    where task.id = p_task_id and task.user_id = p_owner_id
  ) then
    raise exception 'task not found' using errcode = 'P0002';
  end if;

  select calendar.color, calendar.color_mode
  into target_color, target_color_mode
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and calendar.deleted_at is null;

  if not exists (
    select 1 from public.calendars calendar
    where calendar.id = p_calendar_id
      and calendar.user_id = p_owner_id
      and calendar.deleted_at is null
      and not exists (
        select 1 from public.calendar_connections connection
        where connection.calendar_id = calendar.id
      )
  ) then
    raise exception 'writable calendar not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text, 1731));

  insert into public.task_calendar_assignments (
    task_id, calendar_id, user_id, updated_at
  )
  values (p_task_id, p_calendar_id, p_owner_id, now())
  on conflict (task_id) do update
  set calendar_id = excluded.calendar_id,
      updated_at = now()
  where public.task_calendar_assignments.user_id = p_owner_id;

  update public.calendar_events
  set calendar_id = p_calendar_id,
      color = case
        when target_color_mode = 'required_per_event' and color is null
          then target_color
        else color
      end,
      updated_at = now()
  where task_id = p_task_id
    and user_id = p_owner_id
    and deleted_at is null
    and source = 'planevo';
end;
$$;

revoke all on function public.reassign_task_calendar(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.reassign_task_calendar(uuid, uuid, uuid)
  to authenticated, service_role;

create or replace function public.schedule_task_in_calendar_idempotent(
  p_owner_id uuid,
  p_task_id uuid,
  p_calendar_id uuid,
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
  scheduled_event public.calendar_events;
  target_color text;
  target_color_mode text;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_operation_key is null then
    raise exception 'operation key is required' using errcode = '22023';
  end if;
  if p_starts_at is null
    or p_ends_at is null
    or p_ends_at <= p_starts_at
  then
    raise exception 'invalid scheduled time range' using errcode = '22007';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text, 1703));

  if not exists (
    select 1 from public.tasks task
    where task.id = p_task_id and task.user_id = p_owner_id
  ) then
    raise exception 'task not found' using errcode = '42501';
  end if;

  select *
  into scheduled_event
  from public.calendar_events event
  where event.user_id = p_owner_id
    and event.operation_key = p_operation_key;
  if found then
    if scheduled_event.task_id is distinct from p_task_id
      or scheduled_event.deleted_at is not null
      or scheduled_event.source <> 'planevo'
    then
      raise exception 'operation key belongs to another event'
        using errcode = '23505';
    end if;
    return scheduled_event;
  end if;

  if exists (
    select 1 from public.calendar_events event
    where event.task_id = p_task_id
      and event.user_id = p_owner_id
      and event.deleted_at is null
      and event.source = 'planevo'
  ) then
    raise exception 'task already scheduled' using errcode = '23505';
  end if;

  perform public.reassign_task_calendar(
    p_owner_id,
    p_task_id,
    p_calendar_id
  );

  select calendar.color, calendar.color_mode
  into target_color, target_color_mode
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and calendar.deleted_at is null;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    title,
    starts_at,
    ends_at,
    task_id,
    operation_key,
    color
  )
  values (
    p_calendar_id,
    p_owner_id,
    p_title,
    p_starts_at,
    p_ends_at,
    p_task_id,
    p_operation_key,
    case
      when target_color_mode = 'required_per_event' then target_color
      else null
    end
  )
  returning * into scheduled_event;

  update public.tasks
  set due_at = p_starts_at,
      updated_at = now()
  where id = p_task_id
    and user_id = p_owner_id;
  return scheduled_event;
end;
$$;

revoke all on function public.schedule_task_in_calendar_idempotent(
  uuid, uuid, uuid, uuid, text, timestamptz, timestamptz
) from public, anon;
grant execute on function public.schedule_task_in_calendar_idempotent(
  uuid, uuid, uuid, uuid, text, timestamptz, timestamptz
) to authenticated, service_role;

create or replace function public.list_calendar_recurrence_masters_for_context(
  p_owner_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_overlaps boolean,
  p_workspace_event_ids uuid[] default null,
  p_calendar_ids uuid[] default null,
  p_workspace_calendar_ids uuid[] default null
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
        p_calendar_ids is null
        or exception.calendar_id = any (p_calendar_ids)
      )
      and (
        (
          p_overlaps
          and exception.starts_at < p_window_end
          and exception.ends_at > p_window_start
        )
        or (
          not p_overlaps
          and exception.starts_at >= p_window_start
          and exception.starts_at < p_window_end
        )
      )
      and (
        (
          p_workspace_event_ids is null
          and p_workspace_calendar_ids is null
        )
        or (
          p_workspace_event_ids is not null
          and (
            exception.id = any (p_workspace_event_ids)
            or exception.parent_event_id = any (p_workspace_event_ids)
          )
        )
        or (
          p_workspace_calendar_ids is not null
          and exception.calendar_id = any (p_workspace_calendar_ids)
        )
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
        (
          p_calendar_ids is null
          or master.calendar_id = any (p_calendar_ids)
        )
        and
        master.starts_at < p_window_end
        and (
          master.recurrence_end is null
          or master.recurrence_end > (
            p_window_start
            - case
                when p_overlaps
                  then make_interval(
                    mins => greatest(
                      coalesce(master.duration_minutes, 0),
                      0
                    )
                  )
                else interval '0'
              end
          )
        )
        and (
          (
            p_workspace_event_ids is null
            and p_workspace_calendar_ids is null
          )
          or (
            p_workspace_event_ids is not null
            and master.id = any (p_workspace_event_ids)
          )
          or (
            p_workspace_calendar_ids is not null
            and master.calendar_id = any (p_workspace_calendar_ids)
          )
        )
      )
      or master.id in (select parent_event_id from moved_parent_ids)
    )
  order by master.starts_at, master.id;
$$;

revoke all on function public.list_calendar_recurrence_masters_for_context(
  uuid, timestamptz, timestamptz, boolean, uuid[], uuid[], uuid[]
) from public, anon;
grant execute on function public.list_calendar_recurrence_masters_for_context(
  uuid, timestamptz, timestamptz, boolean, uuid[], uuid[], uuid[]
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Workspace embeds: rewrite legacy saved-view identities before dropping them.
-- ---------------------------------------------------------------------------

create or replace function public.rewrite_calendar_embed_nodes(
  p_value jsonb,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  item jsonb;
  result jsonb;
  props jsonb;
  legacy_view_id uuid;
  source_ids uuid[];
  source_count integer;
  source_id uuid;
begin
  if jsonb_typeof(p_value) = 'array' then
    result := '[]'::jsonb;
    for item in select value from jsonb_array_elements(p_value)
    loop
      result := result || jsonb_build_array(
        public.rewrite_calendar_embed_nodes(item, p_owner_id)
      );
    end loop;
    return result;
  end if;

  if jsonb_typeof(p_value) <> 'object' then
    return p_value;
  end if;

  result := '{}'::jsonb;
  for item in select jsonb_build_object(key, value)
    from jsonb_each(p_value)
  loop
    result := result || (
      select jsonb_object_agg(key, public.rewrite_calendar_embed_nodes(value, p_owner_id))
      from jsonb_each(item)
    );
  end loop;

  if p_value ->> 'type' is null
    or p_value ->> 'type' <> 'calendar_embed'
  then
    return result;
  end if;

  props := coalesce(p_value -> 'props', '{}'::jsonb);
  if props ->> 'targetKind' in ('main', 'calendar', 'unavailable') then
    return result;
  end if;
  begin
    legacy_view_id := nullif(props ->> 'viewId', '')::uuid;
  exception when invalid_text_representation then
    legacy_view_id := null;
  end;

  select view.source_calendar_ids
  into source_ids
  from public.calendar_views view
  where view.id = legacy_view_id
    and view.user_id = p_owner_id;

  if not found then
    props := (props - 'viewId')
      || jsonb_build_object(
        'targetKind', 'unavailable',
        'calendarId', '',
        'view', 'month',
        'height', coalesce(nullif(props ->> 'height', ''), 'standard')
      );
  else
    select count(*), min(calendar.id)
    into source_count, source_id
    from public.calendars calendar
    where calendar.user_id = p_owner_id
      and calendar.id = any(source_ids)
      and calendar.deleted_at is null;

    if coalesce(array_length(source_ids, 1), 0) = 1
      and source_count = 1
    then
      props := (props - 'viewId')
        || jsonb_build_object(
          'targetKind', 'calendar',
          'calendarId', source_id::text,
          'view', 'month',
          'height', coalesce(nullif(props ->> 'height', ''), 'standard')
        );
    else
      props := (props - 'viewId')
        || jsonb_build_object(
          'targetKind', 'main',
          'calendarId', '',
          'view', 'month',
          'height', coalesce(nullif(props ->> 'height', ''), 'standard')
        );
    end if;
  end if;

  return jsonb_set(result, '{props}', props, true);
end;
$$;

do $$
begin
  if to_regclass('public.calendar_views') is not null then
    update public.pages page
    set content_json = public.rewrite_calendar_embed_nodes(
      page.content_json,
      workspace.owner_id
    )
    from public.workspaces workspace
    where workspace.id = page.workspace_id
      and page.content_json::text like '%calendar_embed%';
  end if;
end
$$;

drop function if exists public.set_default_calendar_view(uuid, uuid);
drop table if exists public.calendar_views;
drop function if exists public.rewrite_calendar_embed_nodes(jsonb, uuid);

-- ---------------------------------------------------------------------------
-- Calendar links and ownership-safe link RLS.
-- ---------------------------------------------------------------------------

alter table public.workspace_links
  drop constraint if exists workspace_links_resource_type_check;
alter table public.workspace_links
  add constraint workspace_links_resource_type_check check (
    resource_type in ('task', 'calendar_event', 'calendar', 'file')
  ) not valid;
alter table public.workspace_links
  validate constraint workspace_links_resource_type_check;

drop policy if exists workspace_links_via_workspace on public.workspace_links;
drop policy if exists workspace_links_both_endpoints on public.workspace_links;
create policy workspace_links_both_endpoints
  on public.workspace_links for all to authenticated
  using (
    created_by = (select auth.uid())
    and public.is_workspace_owner(workspace_id)
    and (
      (
        resource_type = 'task'
        and exists (
          select 1 from public.tasks task
          where task.id = resource_id
            and task.user_id = (select auth.uid())
        )
      )
      or (
        resource_type = 'calendar_event'
        and exists (
          select 1 from public.calendar_events event
          where event.id = resource_id
            and event.user_id = (select auth.uid())
        )
      )
      or (
        resource_type = 'calendar'
        and exists (
          select 1 from public.calendars calendar
          where calendar.id = resource_id
            and calendar.user_id = (select auth.uid())
            and calendar.deleted_at is null
        )
      )
      or (
        resource_type = 'file'
        and exists (
          select 1 from public.file_sources file
          where file.id = resource_id
            and file.user_id = (select auth.uid())
        )
      )
    )
  )
  with check (
    created_by = (select auth.uid())
    and public.is_workspace_owner(workspace_id)
    and (
      (
        resource_type = 'task'
        and exists (
          select 1 from public.tasks task
          where task.id = resource_id
            and task.user_id = (select auth.uid())
        )
      )
      or (
        resource_type = 'calendar_event'
        and exists (
          select 1 from public.calendar_events event
          where event.id = resource_id
            and event.user_id = (select auth.uid())
        )
      )
      or (
        resource_type = 'calendar'
        and exists (
          select 1 from public.calendars calendar
          where calendar.id = resource_id
            and calendar.user_id = (select auth.uid())
            and calendar.deleted_at is null
        )
      )
      or (
        resource_type = 'file'
        and exists (
          select 1 from public.file_sources file
          where file.id = resource_id
            and file.user_id = (select auth.uid())
        )
      )
    )
  );

insert into public.workspace_links (
  workspace_id,
  resource_type,
  resource_id,
  created_by
)
select distinct
  page.workspace_id,
  'calendar',
  calendar.id,
  workspace.owner_id
from public.pages page
join public.workspaces workspace
  on workspace.id = page.workspace_id
cross join lateral jsonb_path_query(
  page.content_json,
  'strict $.** ? (@.type == "calendar_embed").props'
) props
join public.calendars calendar
  on calendar.user_id = workspace.owner_id
 and calendar.deleted_at is null
 and (
   (
     props ->> 'targetKind' = 'main'
     and calendar.is_main
   )
   or (
     props ->> 'targetKind' = 'calendar'
     and props ->> 'calendarId'
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
     and calendar.id = (props ->> 'calendarId')::uuid
   )
 )
on conflict (workspace_id, resource_type, resource_id) do nothing;

create or replace function public.create_calendar_workspace_page(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_calendar_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  calendar_name text;
  calendar_is_main boolean;
  page_id uuid;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces workspace
    where workspace.id = p_workspace_id
      and workspace.owner_id = p_owner_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  select calendar.name, calendar.is_main
  into calendar_name, calendar_is_main
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and calendar.deleted_at is null;
  if calendar_name is null then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;

  insert into public.pages (
    workspace_id,
    title,
    icon,
    content_json
  )
  values (
    p_workspace_id,
    case
      when calendar_is_main then 'Main Calendar'
      else calendar_name
    end,
    'calendar',
    jsonb_build_array(
      jsonb_build_object(
        'type', 'calendar_embed',
        'props', jsonb_build_object(
          'targetKind', case
            when calendar_is_main then 'main'
            else 'calendar'
          end,
          'calendarId', case
            when calendar_is_main then ''
            else p_calendar_id::text
          end,
          'viewId', '',
          'view', 'month',
          'height', 'tall'
        )
      )
    )
  )
  returning id into page_id;

  insert into public.workspace_links (
    workspace_id,
    resource_type,
    resource_id,
    created_by
  )
  values (
    p_workspace_id,
    'calendar',
    p_calendar_id,
    p_owner_id
  )
  on conflict (workspace_id, resource_type, resource_id) do nothing;
  return page_id;
end;
$$;

revoke all on function public.create_calendar_workspace_page(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.create_calendar_workspace_page(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Native trash, connected-calendar disconnect, and scheduled purge.
-- ---------------------------------------------------------------------------

create or replace function public.trash_calendar(
  p_owner_id uuid,
  p_calendar_id uuid,
  p_move_events_to uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  replacement_id uuid;
  replacement_color text;
  replacement_color_mode text;
  trashed_at timestamptz := now();
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.calendars calendar
    where calendar.id = p_calendar_id
      and calendar.user_id = p_owner_id
      and not calendar.is_main
      and calendar.deleted_at is null
      and not exists (
        select 1 from public.calendar_connections connection
        where connection.calendar_id = calendar.id
      )
  ) then
    raise exception 'native calendar not found' using errcode = 'P0002';
  end if;

  select calendar.id, calendar.color, calendar.color_mode
  into replacement_id, replacement_color, replacement_color_mode
  from public.calendars calendar
  where calendar.user_id = p_owner_id
    and calendar.id <> p_calendar_id
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
    and (p_move_events_to is null or calendar.id = p_move_events_to)
  order by
    (calendar.id = p_move_events_to) desc,
    calendar.is_default desc,
    calendar.is_main desc,
    calendar.created_at,
    calendar.id
  limit 1;

  if replacement_id is null then
    raise exception 'replacement calendar not found' using errcode = 'P0002';
  end if;

  update public.task_calendar_assignments
  set calendar_id = replacement_id,
      updated_at = now()
  where user_id = p_owner_id
    and calendar_id = p_calendar_id;

  if p_move_events_to is not null then
    update public.calendar_events
    set calendar_id = replacement_id,
        color = case
          when replacement_color_mode = 'required_per_event' and color is null
            then replacement_color
          else color
        end,
        updated_at = now()
    where user_id = p_owner_id
      and calendar_id = p_calendar_id
      and deleted_at is null
      and source = 'planevo';
  else
    update public.tasks task
    set due_at = null,
        updated_at = now()
    from public.calendar_events event
    where event.calendar_id = p_calendar_id
      and event.user_id = p_owner_id
      and event.deleted_at is null
      and event.task_id = task.id
      and task.user_id = p_owner_id;

    update public.calendar_events
    set deleted_at = trashed_at,
        updated_at = now()
    where user_id = p_owner_id
      and calendar_id = p_calendar_id
      and deleted_at is null;
  end if;

  if exists (
    select 1 from public.calendars calendar
    where calendar.id = p_calendar_id and calendar.is_default
  ) then
    update public.calendars
    set is_default = (id = replacement_id)
    where user_id = p_owner_id
      and (is_default or id = replacement_id);
  end if;

  update public.calendars
  set deleted_at = trashed_at,
      purge_after = trashed_at + interval '30 days',
      is_default = false,
      is_included_in_main = false
  where id = p_calendar_id
    and user_id = p_owner_id;
end;
$$;

create or replace function public.restore_calendar(
  p_owner_id uuid,
  p_calendar_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trashed_at timestamptz;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select calendar.deleted_at
  into trashed_at
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id
    and not calendar.is_main
    and calendar.deleted_at is not null
    and calendar.purge_after > now()
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  for update;
  if trashed_at is null then
    raise exception 'trashed calendar not found' using errcode = 'P0002';
  end if;

  update public.calendar_events
  set deleted_at = null,
      updated_at = now()
  where calendar_events.calendar_id = p_calendar_id
    and calendar_events.user_id = p_owner_id
    and calendar_events.deleted_at = trashed_at
    and (
      calendar_events.task_id is null
      or not exists (
        select 1
        from public.calendar_events live_event
        where live_event.task_id = calendar_events.task_id
          and live_event.user_id = p_owner_id
          and live_event.deleted_at is null
          and live_event.id <> calendar_events.id
      )
    );

  update public.task_calendar_assignments assignment
  set calendar_id = p_calendar_id,
      updated_at = now()
  from public.calendar_events event
  where event.calendar_id = p_calendar_id
    and event.user_id = p_owner_id
    and event.deleted_at is null
    and event.task_id = assignment.task_id
    and assignment.user_id = p_owner_id;

  update public.tasks task
  set due_at = event.starts_at,
      updated_at = now()
  from public.calendar_events event
  where event.calendar_id = p_calendar_id
    and event.user_id = p_owner_id
    and event.deleted_at is null
    and event.task_id = task.id
    and task.user_id = p_owner_id;

  update public.calendars
  set deleted_at = null,
      purge_after = null,
      is_included_in_main = true
  where id = p_calendar_id
    and user_id = p_owner_id;
end;
$$;

create or replace function public.disconnect_calendar(
  p_owner_id uuid,
  p_calendar_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  replacement_id uuid;
  disconnected_was_default boolean;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.calendar_connections connection
    where connection.calendar_id = p_calendar_id
      and connection.user_id = p_owner_id
  ) then
    raise exception 'connected calendar not found' using errcode = 'P0002';
  end if;

  select calendar.is_default
  into disconnected_was_default
  from public.calendars calendar
  where calendar.id = p_calendar_id
    and calendar.user_id = p_owner_id;

  select calendar.id
  into replacement_id
  from public.calendars calendar
  where calendar.user_id = p_owner_id
    and calendar.id <> p_calendar_id
    and calendar.deleted_at is null
    and not exists (
      select 1 from public.calendar_connections connection
      where connection.calendar_id = calendar.id
    )
  order by calendar.is_default desc, calendar.is_main desc, calendar.created_at
  limit 1;

  if replacement_id is not null then
    update public.task_calendar_assignments
    set calendar_id = replacement_id,
        updated_at = now()
    where user_id = p_owner_id
      and calendar_id = p_calendar_id;

    if disconnected_was_default then
      update public.calendars
      set is_default = (id = replacement_id)
      where user_id = p_owner_id
        and (is_default or id = replacement_id);
    end if;
  end if;

  update public.tasks task
  set due_at = null,
      updated_at = now()
  from public.calendar_events event
  where event.calendar_id = p_calendar_id
    and event.user_id = p_owner_id
    and event.task_id = task.id
    and task.user_id = p_owner_id;

  delete from public.file_links
  where target_type = 'calendar_event'
    and target_id in (
      select event.id
      from public.calendar_events event
      where event.calendar_id = p_calendar_id
        and event.user_id = p_owner_id
    );
  delete from public.workspace_links
  where (
      resource_type = 'calendar'
      and resource_id = p_calendar_id
    )
    or (
      resource_type = 'calendar_event'
      and resource_id in (
        select event.id
        from public.calendar_events event
        where event.calendar_id = p_calendar_id
          and event.user_id = p_owner_id
      )
    );
  -- Deleting the owned calendar performs the canonical FK cascade. A direct
  -- event delete would be rejected by the external-event read-only RLS policy.
  delete from public.calendars
  where id = p_calendar_id and user_id = p_owner_id and not is_main;
end;
$$;

create or replace function public.purge_deleted_calendars()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  purged_count integer;
  purging_ids uuid[];
begin
  select array_agg(calendar.id)
  into purging_ids
  from public.calendars calendar
  where not calendar.is_main
    and calendar.purge_after is not null
    and calendar.purge_after <= now();
  if coalesce(array_length(purging_ids, 1), 0) = 0 then
    return 0;
  end if;

  delete from public.file_links
  where target_type = 'calendar_event'
    and target_id in (
      select event.id
      from public.calendar_events event
      where event.calendar_id = any(purging_ids)
    );
  delete from public.workspace_links
  where (
      resource_type = 'calendar'
      and resource_id = any(purging_ids)
    )
    or (
      resource_type = 'calendar_event'
      and resource_id in (
        select event.id
        from public.calendar_events event
        where event.calendar_id = any(purging_ids)
      )
    );
  delete from public.calendars
  where id = any(purging_ids);
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

revoke all on function public.trash_calendar(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.trash_calendar(uuid, uuid, uuid)
  to authenticated, service_role;
revoke all on function public.restore_calendar(uuid, uuid)
  from public, anon;
grant execute on function public.restore_calendar(uuid, uuid)
  to authenticated, service_role;
revoke all on function public.disconnect_calendar(uuid, uuid)
  from public, anon;
grant execute on function public.disconnect_calendar(uuid, uuid)
  to authenticated, service_role;
revoke all on function public.purge_deleted_calendars()
  from public, anon, authenticated;
grant execute on function public.purge_deleted_calendars()
  to service_role;

do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'purge-deleted-calendars';
    perform cron.schedule(
      'purge-deleted-calendars',
      '17 3 * * *',
      'select public.purge_deleted_calendars()'
    );
  end if;
end;
$$;
