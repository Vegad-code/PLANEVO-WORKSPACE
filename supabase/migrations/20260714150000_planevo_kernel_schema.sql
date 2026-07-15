-- Planevo kernel schema (PRD §4.2)
-- Multi-tenant from day one: RLS on every table.
--
-- Order matters: tables before functions that reference them.

-- ---------------------------------------------------------------------------
-- Trigger helper (no table references — safe to create first)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_page_id uuid references public.pages (id) on delete cascade,
  title text not null default 'Untitled',
  icon text,
  content_json jsonb not null default '[]'::jsonb,
  database_id uuid,
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.databases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  name text not null,
  icon text,
  template_type text not null default 'custom',
  created_at timestamptz not null default now()
);

alter table public.pages
  add constraint pages_database_id_fkey
  foreign key (database_id) references public.databases (id) on delete set null;

create table public.database_properties (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.databases (id) on delete cascade,
  name text not null,
  type text not null,
  config_json jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.records (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.databases (id) on delete cascade,
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.record_values (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  property_id uuid not null references public.database_properties (id) on delete cascade,
  value_json jsonb not null default 'null'::jsonb,
  unique (record_id, property_id)
);

create table public.relations (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid not null references public.records (id) on delete cascade,
  source_property_id uuid not null references public.database_properties (id) on delete cascade,
  target_record_id uuid not null references public.records (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index relations_source_lookup_idx
  on public.relations (source_record_id, source_property_id);

create index relations_target_lookup_idx
  on public.relations (target_record_id);

create table public.views (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.databases (id) on delete cascade,
  type text not null,
  name text not null,
  config_json jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  context_page_id uuid references public.pages (id) on delete set null,
  context_database_id uuid references public.databases (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  session_id uuid references public.agent_sessions (id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  icon text,
  description text,
  instructions text,
  model_config_json jsonb not null default '{}'::jsonb,
  knowledge_scope_json jsonb not null default '{}'::jsonb,
  workflow_config_json jsonb not null default '{}'::jsonb,
  visibility text not null default 'private',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,
  model_used text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (after tables exist)
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_database(target_database_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.databases d
    where d.id = target_database_id
      and public.is_workspace_owner(d.workspace_id)
  );
$$;

create or replace function public.can_access_record(target_record_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.records r
    join public.databases d on d.id = r.database_id
    where r.id = target_record_id
      and public.is_workspace_owner(d.workspace_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.pages enable row level security;
alter table public.databases enable row level security;
alter table public.database_properties enable row level security;
alter table public.records enable row level security;
alter table public.record_values enable row level security;
alter table public.relations enable row level security;
alter table public.views enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.agent_actions enable row level security;
alter table public.agents enable row level security;
alter table public.credit_ledger enable row level security;

-- workspaces
create policy "workspace owners select workspaces"
  on public.workspaces for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "workspace owners insert workspaces"
  on public.workspaces for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "workspace owners update workspaces"
  on public.workspaces for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "workspace owners delete workspaces"
  on public.workspaces for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- pages
create policy "workspace owners select pages"
  on public.pages for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "workspace owners insert pages"
  on public.pages for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners update pages"
  on public.pages for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners delete pages"
  on public.pages for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- databases
create policy "workspace owners select databases"
  on public.databases for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "workspace owners insert databases"
  on public.databases for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners update databases"
  on public.databases for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners delete databases"
  on public.databases for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- database_properties
create policy "workspace owners select database_properties"
  on public.database_properties for select
  to authenticated
  using (public.can_access_database(database_id));

create policy "workspace owners insert database_properties"
  on public.database_properties for insert
  to authenticated
  with check (public.can_access_database(database_id));

create policy "workspace owners update database_properties"
  on public.database_properties for update
  to authenticated
  using (public.can_access_database(database_id))
  with check (public.can_access_database(database_id));

create policy "workspace owners delete database_properties"
  on public.database_properties for delete
  to authenticated
  using (public.can_access_database(database_id));

-- records
create policy "workspace owners select records"
  on public.records for select
  to authenticated
  using (public.can_access_database(database_id));

create policy "workspace owners insert records"
  on public.records for insert
  to authenticated
  with check (public.can_access_database(database_id));

create policy "workspace owners update records"
  on public.records for update
  to authenticated
  using (public.can_access_database(database_id))
  with check (public.can_access_database(database_id));

create policy "workspace owners delete records"
  on public.records for delete
  to authenticated
  using (public.can_access_database(database_id));

-- record_values
create policy "workspace owners select record_values"
  on public.record_values for select
  to authenticated
  using (public.can_access_record(record_id));

create policy "workspace owners insert record_values"
  on public.record_values for insert
  to authenticated
  with check (public.can_access_record(record_id));

create policy "workspace owners update record_values"
  on public.record_values for update
  to authenticated
  using (public.can_access_record(record_id))
  with check (public.can_access_record(record_id));

create policy "workspace owners delete record_values"
  on public.record_values for delete
  to authenticated
  using (public.can_access_record(record_id));

-- relations
create policy "workspace owners select relations"
  on public.relations for select
  to authenticated
  using (public.can_access_record(source_record_id));

create policy "workspace owners insert relations"
  on public.relations for insert
  to authenticated
  with check (public.can_access_record(source_record_id));

create policy "workspace owners update relations"
  on public.relations for update
  to authenticated
  using (public.can_access_record(source_record_id))
  with check (public.can_access_record(source_record_id));

create policy "workspace owners delete relations"
  on public.relations for delete
  to authenticated
  using (public.can_access_record(source_record_id));

-- views
create policy "workspace owners select views"
  on public.views for select
  to authenticated
  using (public.can_access_database(database_id));

create policy "workspace owners insert views"
  on public.views for insert
  to authenticated
  with check (public.can_access_database(database_id));

create policy "workspace owners update views"
  on public.views for update
  to authenticated
  using (public.can_access_database(database_id))
  with check (public.can_access_database(database_id));

create policy "workspace owners delete views"
  on public.views for delete
  to authenticated
  using (public.can_access_database(database_id));

-- agent_sessions
create policy "workspace owners select agent_sessions"
  on public.agent_sessions for select
  to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
  );

create policy "workspace owners insert agent_sessions"
  on public.agent_sessions for insert
  to authenticated
  with check (
    public.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
  );

create policy "workspace owners update agent_sessions"
  on public.agent_sessions for update
  to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
  )
  with check (
    public.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
  );

create policy "workspace owners delete agent_sessions"
  on public.agent_sessions for delete
  to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    and user_id = (select auth.uid())
  );

-- agent_actions
create policy "workspace owners select agent_actions"
  on public.agent_actions for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "workspace owners insert agent_actions"
  on public.agent_actions for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners update agent_actions"
  on public.agent_actions for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners delete agent_actions"
  on public.agent_actions for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- agents
create policy "workspace owners select agents"
  on public.agents for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "workspace owners insert agents"
  on public.agents for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners update agents"
  on public.agents for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace owners delete agents"
  on public.agents for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- credit_ledger
create policy "users select own credit_ledger"
  on public.credit_ledger for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert own credit_ledger"
  on public.credit_ledger for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants (authenticated role only — workspace data is never public)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.pages to authenticated;
grant select, insert, update, delete on public.databases to authenticated;
grant select, insert, update, delete on public.database_properties to authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant select, insert, update, delete on public.record_values to authenticated;
grant select, insert, update, delete on public.relations to authenticated;
grant select, insert, update, delete on public.views to authenticated;
grant select, insert, update, delete on public.agent_sessions to authenticated;
grant select, insert, update, delete on public.agent_actions to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select, insert on public.credit_ledger to authenticated;
