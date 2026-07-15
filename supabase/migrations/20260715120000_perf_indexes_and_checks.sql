-- Performance indexes for every hot foreign key the read paths filter on,
-- CHECK constraints for the enum-shaped text columns the kernel left open,
-- and a race-free record position in create_task_with_required_foundation.
--
-- Deliberately NO check on database_properties.type: PRD §4.3 mandates plain
-- TEXT with app-level validation so `formula`/`rollup` land with zero migration.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists workspaces_owner_idx
  on public.workspaces (owner_id, created_at);

create index if not exists pages_workspace_idx
  on public.pages (workspace_id, position);

create index if not exists pages_parent_idx
  on public.pages (parent_page_id);

create index if not exists databases_workspace_idx
  on public.databases (workspace_id, created_at);

create index if not exists database_properties_database_idx
  on public.database_properties (database_id, position);

create index if not exists records_database_idx
  on public.records (database_id, position);

create index if not exists record_values_property_idx
  on public.record_values (property_id);

create index if not exists views_database_idx
  on public.views (database_id, position);

create index if not exists agents_workspace_idx
  on public.agents (workspace_id);

create index if not exists agent_sessions_workspace_idx
  on public.agent_sessions (workspace_id);

create index if not exists agent_actions_workspace_idx
  on public.agent_actions (workspace_id, created_at);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at);

-- ---------------------------------------------------------------------------
-- CHECK constraints on enum-shaped text columns
-- (database_properties.type intentionally excluded — see header)
-- ---------------------------------------------------------------------------

alter table public.views
  add constraint views_type_check
  check (type in ('table', 'board', 'calendar', 'list'));

alter table public.agent_actions
  add constraint agent_actions_status_check
  check (status in ('proposed', 'confirmed', 'executed', 'rejected'));

alter table public.agents
  add constraint agents_visibility_check
  check (visibility in ('private', 'workspace'));

-- ---------------------------------------------------------------------------
-- Race-free record position: max(position)+1 under a per-database advisory
-- lock instead of count(*) (count is wrong after deletes and racy under
-- concurrent inserts). Function body otherwise identical to 20260715004609.
-- ---------------------------------------------------------------------------

create or replace function public.create_task_with_required_foundation(
  p_owner_id uuid,
  p_workspace_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_status text default 'To do',
  p_priority text default null,
  p_due_date timestamptz default null,
  p_estimate_minutes integer default null,
  p_tags jsonb default '[]'::jsonb,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  target_database_id uuid;
  created_record_id uuid;
  foundation jsonb;
  property_row record;
  value_payload jsonb;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'task title is required' using errcode = '22023';
  end if;
  if p_estimate_minutes is not null and p_estimate_minutes < 0 then
    raise exception 'estimate minutes cannot be negative' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tags) <> 'array' or jsonb_typeof(p_attachments) <> 'array' then
    raise exception 'tags and attachments must be arrays' using errcode = '22023';
  end if;

  if p_workspace_id is not null then
    select id into target_workspace_id from public.workspaces
    where id = p_workspace_id and owner_id = p_owner_id;
    if target_workspace_id is null then
      raise exception 'workspace not found' using errcode = 'P0002';
    end if;
  else
    select id into target_workspace_id from public.workspaces
    where owner_id = p_owner_id order by created_at asc limit 1;
  end if;

  if target_workspace_id is null then
    insert into public.workspaces (owner_id, name)
    values (p_owner_id, 'My workspace')
    returning id into target_workspace_id;
  end if;

  select id into target_database_id from public.databases
  where workspace_id = target_workspace_id and template_type = 'task'
  order by created_at asc limit 1;

  if target_database_id is null then
    foundation := public.create_task_database_with_views(p_owner_id, target_workspace_id, 'Tasks');
    target_database_id := (foundation ->> 'database_id')::uuid;
  end if;

  perform pg_advisory_xact_lock(hashtext(target_database_id::text));

  insert into public.records (database_id, position, created_by)
  values (
    target_database_id,
    (select coalesce(max(position) + 1, 0)::integer
       from public.records where database_id = target_database_id),
    p_owner_id
  )
  returning id into created_record_id;

  for property_row in
    select id, name from public.database_properties where database_id = target_database_id
  loop
    value_payload := case property_row.name
      when 'Task' then to_jsonb(btrim(p_title))
      when 'Description' then to_jsonb(p_description)
      when 'Status' then to_jsonb(coalesce(nullif(btrim(p_status), ''), 'To do'))
      when 'Priority' then to_jsonb(p_priority)
      when 'Due date' then to_jsonb(p_due_date)
      when 'Estimate' then to_jsonb(p_estimate_minutes)
      when 'Tags' then p_tags
      when 'Attachments' then p_attachments
      else null
    end;
    if value_payload is not null and value_payload <> 'null'::jsonb then
      insert into public.record_values (record_id, property_id, value_json)
      values (created_record_id, property_row.id, value_payload);
    end if;
  end loop;

  return jsonb_build_object(
    'workspace_id', target_workspace_id,
    'database_id', target_database_id,
    'record_id', created_record_id
  );
end;
$$;
