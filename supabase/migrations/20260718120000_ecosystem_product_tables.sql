-- Ecosystem Phase 1 — product tables and link layer (PRD v2.0 F-01, F-02)
-- Strangler pattern: Tasks/Calendar/Files become real products with their own
-- tables, linked into workspaces via workspace_links instead of living inside
-- the universal kernel (databases/records). See AGENTS.md ecosystem rules.
--
-- Order matters: tables before RLS; file_sources.user_id must exist before
-- the file_links RLS policy can reference it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'cancelled')),
  priority text check (priority is null or priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  description_json jsonb not null default '{}'::jsonb,
  position numeric not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_position_idx on public.tasks (user_id, position);
create index tasks_user_due_idx on public.tasks (user_id, due_at) where due_at is not null;

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position numeric not null default 0,
  created_at timestamptz not null default now()
);
create index task_subtasks_task_position_idx on public.task_subtasks (task_id, position);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  is_visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index calendars_user_position_idx on public.calendars (user_id, position);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  description_json jsonb not null default '{}'::jsonb,
  task_id uuid references public.tasks (id) on delete set null,
  google_event_id text,
  source text not null default 'planevo'
    check (source in ('planevo', 'google')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_calendar_start_idx on public.calendar_events (calendar_id, starts_at);
create index calendar_events_user_start_idx on public.calendar_events (user_id, starts_at);

-- workspace_links (F-02): explicit handshake between a workspace and a
-- product resource living outside the kernel. No universal kernel table.
create table public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  resource_type text not null check (resource_type in ('task', 'calendar_event', 'file')),
  resource_id uuid not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, resource_type, resource_id)
);
create index workspace_links_workspace_type_idx
  on public.workspace_links (workspace_id, resource_type);

-- file_links: cross-feature attachment of an existing file to a task or
-- calendar event (does not move the file, just references it).
create table public.file_links (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  target_type text not null check (target_type in ('task', 'calendar_event')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (file_source_id, target_type, target_id)
);

-- ---------------------------------------------------------------------------
-- file_sources: evolve toward user-scoped ownership (PRD §7.3 strangler)
-- ---------------------------------------------------------------------------
-- file_sources currently tracks ownership via `created_by` (see
-- 20260715004609_planevo_app_foundations.sql). Add `user_id` alongside it and
-- backfill so file_links RLS below (and future product code) has a single,
-- consistently named owner column to check. Kept nullable here; NOT NULL is
-- a follow-up once all rows are confirmed backfilled.

alter table public.file_sources
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.file_sources set user_id = created_by where user_id is null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;
create policy tasks_owner on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.task_subtasks enable row level security;
create policy task_subtasks_via_task on public.task_subtasks for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));

alter table public.calendars enable row level security;
create policy calendars_owner on public.calendars for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.calendar_events enable row level security;
create policy calendar_events_owner on public.calendar_events for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- workspace_links: gated by the same workspace-ownership chain the kernel
-- tables use (public.is_workspace_owner, defined in
-- 20260714150000_planevo_kernel_schema.sql).
alter table public.workspace_links enable row level security;
create policy workspace_links_via_workspace on public.workspace_links for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- file_links: gated by file_sources ownership (user_id, backfilled above).
alter table public.file_links enable row level security;
create policy file_links_via_file_source on public.file_links for all to authenticated
  using (
    exists (
      select 1 from public.file_sources fs
      where fs.id = file_source_id and fs.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.file_sources fs
      where fs.id = file_source_id and fs.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (authenticated role only — product data is never public)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_subtasks to authenticated;
grant select, insert, update, delete on public.calendars to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.workspace_links to authenticated;
grant select, insert, update, delete on public.file_links to authenticated;

-- ---------------------------------------------------------------------------
-- create_user_products: seed a user's global Tasks + Calendar products
-- (F-01/F-02 ecosystem strangler — these replace the per-workspace task and
-- calendar template databases that create_starter_workspace used to create).
-- security invoker: relies on the tasks/calendars RLS policies above, which
-- already require user_id = auth.uid(); the explicit guard below matches the
-- convention in 20260717120000_starter_workspace_and_kernel.sql so a caller
-- can never write products under someone else's user id.
-- Idempotent: a user's global products are created once. If a calendar
-- already exists for p_user_id, the existing state is returned unchanged.
-- ---------------------------------------------------------------------------

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
  existing_calendar_id uuid;
  new_calendar_id uuid;
  calendar_name text;
  task_el jsonb;
  new_task_id uuid;
  task_ids uuid[] := array[]::uuid[];
  pos numeric := 0;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'user id does not match the mutation actor' using errcode = '42501';
  end if;

  select c.id into existing_calendar_id
  from public.calendars c
  where c.user_id = p_user_id
  order by c.created_at asc
  limit 1;

  if existing_calendar_id is not null then
    select coalesce(array_agg(t.id order by t.position asc), array[]::uuid[])
    into task_ids
    from public.tasks t
    where t.user_id = p_user_id;

    return jsonb_build_object(
      'calendar_id', existing_calendar_id,
      'task_ids', to_jsonb(task_ids),
      'created', false
    );
  end if;

  calendar_name := coalesce(nullif(btrim(p_seed ->> 'calendarName'), ''), 'My Calendar');

  insert into public.calendars (user_id, name)
  values (p_user_id, calendar_name)
  returning id into new_calendar_id;

  for task_el in
    select * from jsonb_array_elements(coalesce(p_seed -> 'starterTasks', '[]'::jsonb))
  loop
    insert into public.tasks (user_id, title, status, position)
    values (
      p_user_id,
      coalesce(nullif(btrim(task_el ->> 'title'), ''), 'Untitled'),
      coalesce(nullif(btrim(task_el ->> 'status'), ''), 'not_started'),
      pos
    )
    returning id into new_task_id;

    task_ids := array_append(task_ids, new_task_id);
    pos := pos + 1;
  end loop;

  return jsonb_build_object(
    'calendar_id', new_calendar_id,
    'task_ids', to_jsonb(task_ids),
    'created', true
  );
end;
$$;

revoke all on function public.create_user_products(uuid, jsonb) from public, anon;
grant execute on function public.create_user_products(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_starter_workspace_v2: seed workspace + pages only (F-45 ecosystem
-- rewrite). Ports the workspace-creation and page/block-seeding half of
-- create_starter_workspace (20260717120000_starter_workspace_and_kernel.sql)
-- as-is. Drops the create_database_from_template calls and the
-- onboardingTasks record-seeding loop from v1 — task/calendar/files template
-- databases are no longer created per-workspace; equivalent starter records
-- are seeded once per user by create_user_products above. settings_json
-- therefore never gets default_task_database_id / default_calendar_database_id
-- / default_files_database_id keys.
-- ---------------------------------------------------------------------------

create or replace function public.create_starter_workspace_v2(
  p_owner_id uuid,
  p_seed jsonb,
  p_workspace_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organizing text;
  workspace_name text;
  workspace_icon text;
  created_workspace_id uuid;
  getting_started_page_id uuid;
  notes_page_id uuid;
  existing_page_count integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  organizing := p_seed ->> 'organizing';
  if organizing is null or organizing not in ('work', 'personal', 'school', 'other') then
    raise exception 'organizing answer is required' using errcode = '22023';
  end if;

  workspace_name := coalesce(nullif(btrim(p_seed ->> 'workspaceName'), ''), 'My Workspace');
  workspace_icon := p_seed ->> 'workspaceIcon';

  -- Seed into an existing empty workspace when provided (avoids orphan rows).
  if p_workspace_id is not null then
    select w.id into created_workspace_id
    from public.workspaces w
    where w.id = p_workspace_id and w.owner_id = p_owner_id;
    if created_workspace_id is null then
      raise exception 'workspace not found' using errcode = 'P0002';
    end if;
    select count(*)::integer into existing_page_count
    from public.pages p where p.workspace_id = created_workspace_id;
    if existing_page_count > 0 then
      raise exception 'workspace already has pages' using errcode = '22023';
    end if;
    update public.workspaces
    set name = workspace_name, icon = workspace_icon
    where id = created_workspace_id;
  else
    insert into public.workspaces (owner_id, name, icon)
    values (p_owner_id, workspace_name, workspace_icon)
    returning id into created_workspace_id;
  end if;

  -- Getting Started page (position 0) — landing target
  insert into public.pages (
    workspace_id, title, icon, position, content_json
  )
  values (
    created_workspace_id,
    coalesce(p_seed -> 'gettingStarted' ->> 'title', 'Getting Started'),
    coalesce(p_seed -> 'gettingStarted' ->> 'icon', '👋'),
    0,
    coalesce(p_seed -> 'gettingStarted' -> 'content', '[]'::jsonb)
  )
  returning id into getting_started_page_id;

  -- Notes page (position 1)
  insert into public.pages (
    workspace_id, title, icon, position, content_json
  )
  values (
    created_workspace_id,
    coalesce(p_seed -> 'notes' ->> 'title', 'Notes'),
    coalesce(p_seed -> 'notes' ->> 'icon', '📝'),
    1,
    coalesce(p_seed -> 'notes' -> 'content', '[]'::jsonb)
  )
  returning id into notes_page_id;

  update public.workspaces
  set settings_json = jsonb_build_object(
    'getting_started_page_id', getting_started_page_id,
    'notes_page_id', notes_page_id,
    'organizing', organizing
  )
  where id = created_workspace_id;

  insert into public.onboarding_progress (
    user_id,
    workspace_id,
    organizing,
    current_step,
    completed_steps_json,
    completed_at
  )
  values (
    p_owner_id,
    created_workspace_id,
    organizing,
    3,
    jsonb_build_array('routing', 'seed', 'landing'),
    now()
  )
  on conflict (user_id) do update set
    workspace_id = excluded.workspace_id,
    organizing = excluded.organizing,
    current_step = excluded.current_step,
    completed_steps_json = excluded.completed_steps_json,
    completed_at = excluded.completed_at,
    updated_at = now();

  return jsonb_build_object(
    'workspace_id', created_workspace_id,
    'getting_started_page_id', getting_started_page_id,
    'notes_page_id', notes_page_id
  );
end;
$$;

revoke all on function public.create_starter_workspace_v2(uuid, jsonb, uuid) from public, anon;
grant execute on function public.create_starter_workspace_v2(uuid, jsonb, uuid) to authenticated, service_role;
