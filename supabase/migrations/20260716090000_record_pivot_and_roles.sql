-- Kernel phase: one-round-trip record loading, stable property roles, and
-- duplicate-and-strip (PRD §5.3 #3).
--
-- Property ROLES live in database_properties.config_json ->> 'role'. Reads and
-- writes key on the role, never the display name, so renaming "Status" to
-- "Stage" breaks nothing. Roles: title status priority due_date description
-- estimate tags attachments event_date.

-- ---------------------------------------------------------------------------
-- get_database_records: pivoted records in one call. security invoker → RLS
-- on records/record_values applies to the caller.
-- ---------------------------------------------------------------------------

create or replace function public.get_database_records(
  p_database_id uuid,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  record_id uuid,
  record_position integer,
  created_at timestamptz,
  updated_at timestamptz,
  values_json jsonb
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    r.id,
    r.position,
    r.created_at,
    r.updated_at,
    coalesce(
      jsonb_object_agg(rv.property_id, rv.value_json)
        filter (where rv.property_id is not null),
      '{}'::jsonb
    )
  from public.records r
  left join public.record_values rv on rv.record_id = r.id
  where r.database_id = p_database_id
  group by r.id
  order by r.position asc, r.created_at asc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------------------------------------------------------------------------
-- Born-with-views RPCs now stamp roles into config_json
-- ---------------------------------------------------------------------------

create or replace function public.create_task_database_with_views(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_name text default 'Tasks'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_page_id uuid;
  created_database_id uuid;
  title_property_id uuid;
  status_property_id uuid;
  due_property_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p_owner_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  insert into public.pages (workspace_id, title, icon, position)
  values (p_workspace_id, coalesce(nullif(btrim(p_name), ''), 'Tasks'), 'check-circle', 0)
  returning id into created_page_id;

  insert into public.databases (workspace_id, page_id, name, icon, template_type)
  values (p_workspace_id, created_page_id, coalesce(nullif(btrim(p_name), ''), 'Tasks'), 'check-circle', 'task')
  returning id into created_database_id;

  update public.pages set database_id = created_database_id where id = created_page_id;

  insert into public.database_properties (database_id, name, type, position, is_primary, config_json)
  values (created_database_id, 'Task', 'text', 0, true, jsonb_build_object('role', 'title'))
  returning id into title_property_id;
  insert into public.database_properties (database_id, name, type, position, config_json)
  values
    (created_database_id, 'Description', 'text', 1, jsonb_build_object('role', 'description')),
    (created_database_id, 'Status', 'select', 2, jsonb_build_object('role', 'status', 'options', jsonb_build_array('To do', 'In progress', 'In review', 'Done'))),
    (created_database_id, 'Priority', 'select', 3, jsonb_build_object('role', 'priority', 'options', jsonb_build_array('Low', 'Medium', 'High'))),
    (created_database_id, 'Due date', 'date', 4, jsonb_build_object('role', 'due_date')),
    (created_database_id, 'Estimate', 'number', 5, jsonb_build_object('role', 'estimate')),
    (created_database_id, 'Tags', 'multi-select', 6, jsonb_build_object('role', 'tags')),
    (created_database_id, 'Attachments', 'text', 7, jsonb_build_object('role', 'attachments'));

  select id into status_property_id from public.database_properties
    where database_id = created_database_id and config_json ->> 'role' = 'status';
  select id into due_property_id from public.database_properties
    where database_id = created_database_id and config_json ->> 'role' = 'due_date';

  insert into public.views (database_id, type, name, config_json, position, is_default)
  values
    (created_database_id, 'board', 'Board', jsonb_build_object('group_by_property_id', status_property_id), 0, true),
    (created_database_id, 'list', 'List', '{}'::jsonb, 1, false),
    (created_database_id, 'calendar', 'Calendar', jsonb_build_object('date_property_id', due_property_id), 2, false),
    (created_database_id, 'table', 'Table', '{}'::jsonb, 3, false);

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'page_id', created_page_id,
    'database_id', created_database_id,
    'title_property_id', title_property_id
  );
end;
$$;

create or replace function public.create_calendar_database_with_views(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_name text default 'Calendar'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_page_id uuid;
  created_database_id uuid;
  date_property_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p_owner_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  insert into public.pages (workspace_id, title, icon, position)
  values (p_workspace_id, coalesce(nullif(btrim(p_name), ''), 'Calendar'), 'calendar', 1)
  returning id into created_page_id;

  insert into public.databases (workspace_id, page_id, name, icon, template_type)
  values (p_workspace_id, created_page_id, coalesce(nullif(btrim(p_name), ''), 'Calendar'), 'calendar', 'calendar')
  returning id into created_database_id;
  update public.pages set database_id = created_database_id where id = created_page_id;

  insert into public.database_properties (database_id, name, type, position, is_primary, config_json)
  values (created_database_id, 'Event', 'text', 0, true, jsonb_build_object('role', 'title'));
  insert into public.database_properties (database_id, name, type, position, config_json)
  values (created_database_id, 'Date', 'date', 1, jsonb_build_object('role', 'event_date'))
  returning id into date_property_id;
  insert into public.database_properties (database_id, name, type, position, config_json)
  values
    (created_database_id, 'Description', 'text', 2, jsonb_build_object('role', 'description')),
    (created_database_id, 'Status', 'select', 3, jsonb_build_object('role', 'status'));

  insert into public.views (database_id, type, name, config_json, position, is_default)
  values
    (created_database_id, 'calendar', 'Calendar', jsonb_build_object('date_property_id', date_property_id), 0, true),
    (created_database_id, 'list', 'List', '{}'::jsonb, 1, false),
    (created_database_id, 'table', 'Table', '{}'::jsonb, 2, false);

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'page_id', created_page_id,
    'database_id', created_database_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill roles onto existing template databases — the last time display
-- names are load-bearing.
-- ---------------------------------------------------------------------------

update public.database_properties dp
set config_json = dp.config_json || jsonb_build_object('role', mapping.role)
from public.databases d,
  (values
    ('task', 'Task', 'title'),
    ('task', 'Description', 'description'),
    ('task', 'Status', 'status'),
    ('task', 'Priority', 'priority'),
    ('task', 'Due date', 'due_date'),
    ('task', 'Estimate', 'estimate'),
    ('task', 'Tags', 'tags'),
    ('task', 'Attachments', 'attachments'),
    ('calendar', 'Event', 'title'),
    ('calendar', 'Date', 'event_date'),
    ('calendar', 'Description', 'description'),
    ('calendar', 'Status', 'status')
  ) as mapping(template_type, name, role)
where dp.database_id = d.id
  and d.template_type = mapping.template_type
  and dp.name = mapping.name
  and dp.config_json ->> 'role' is null;

update public.database_properties dp
set config_json = dp.config_json
  || jsonb_build_object('options', jsonb_build_array('To do', 'In progress', 'In review', 'Done'))
from public.databases d
where dp.database_id = d.id
  and d.template_type = 'task'
  and dp.config_json ->> 'role' = 'status'
  and dp.config_json -> 'options' is null;

-- ---------------------------------------------------------------------------
-- Task creation keys on roles (title still lands on the primary property)
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
    select id, is_primary, config_json ->> 'role' as role
    from public.database_properties where database_id = target_database_id
  loop
    value_payload := case
      when property_row.is_primary then to_jsonb(btrim(p_title))
      else case property_row.role
        when 'description' then to_jsonb(p_description)
        when 'status' then to_jsonb(coalesce(nullif(btrim(p_status), ''), 'To do'))
        when 'priority' then to_jsonb(p_priority)
        when 'due_date' then to_jsonb(p_due_date)
        when 'estimate' then to_jsonb(p_estimate_minutes)
        when 'tags' then p_tags
        when 'attachments' then p_attachments
        else null
      end
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

-- ---------------------------------------------------------------------------
-- duplicate_database_structure: same properties/views/layout, zero records
-- (PRD §5.3 #3 duplicate-and-strip). View configs that reference property ids
-- are remapped to the cloned ids.
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_database_structure(
  p_owner_id uuid,
  p_database_id uuid,
  p_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_database public.databases;
  created_page_id uuid;
  created_database_id uuid;
  property_row public.database_properties;
  view_row public.views;
  new_property_id uuid;
  property_id_map jsonb := '{}'::jsonb;
  new_config jsonb;
  key_name text;
  mapped_id text;
  new_name text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  select d.* into source_database
  from public.databases d
  join public.workspaces w on w.id = d.workspace_id
  where d.id = p_database_id and w.owner_id = p_owner_id;
  if source_database.id is null then
    raise exception 'database not found' using errcode = 'P0002';
  end if;

  new_name := coalesce(nullif(btrim(p_name), ''), source_database.name || ' copy');

  insert into public.pages (workspace_id, title, icon, position)
  values (
    source_database.workspace_id,
    new_name,
    source_database.icon,
    (select coalesce(max(position) + 1, 0) from public.pages
      where workspace_id = source_database.workspace_id and parent_page_id is null)
  )
  returning id into created_page_id;

  insert into public.databases (workspace_id, page_id, name, icon, template_type)
  values (source_database.workspace_id, created_page_id, new_name, source_database.icon, source_database.template_type)
  returning id into created_database_id;

  update public.pages set database_id = created_database_id where id = created_page_id;

  for property_row in
    select * from public.database_properties
    where database_id = p_database_id order by position asc
  loop
    insert into public.database_properties (database_id, name, type, config_json, position, is_primary)
    values (created_database_id, property_row.name, property_row.type, property_row.config_json, property_row.position, property_row.is_primary)
    returning id into new_property_id;
    property_id_map := property_id_map || jsonb_build_object(property_row.id::text, new_property_id::text);
  end loop;

  for view_row in
    select * from public.views where database_id = p_database_id order by position asc
  loop
    new_config := view_row.config_json;
    for key_name in select jsonb_object_keys(view_row.config_json)
    loop
      mapped_id := property_id_map ->> (view_row.config_json ->> key_name);
      if mapped_id is not null then
        new_config := new_config || jsonb_build_object(key_name, mapped_id);
      end if;
    end loop;
    insert into public.views (database_id, type, name, config_json, position, is_default)
    values (created_database_id, view_row.type, view_row.name, new_config, view_row.position, view_row.is_default);
  end loop;

  return jsonb_build_object(
    'workspace_id', source_database.workspace_id,
    'page_id', created_page_id,
    'database_id', created_database_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — match house style
-- ---------------------------------------------------------------------------

revoke all on function public.get_database_records(uuid, integer, integer) from public, anon;
revoke all on function public.duplicate_database_structure(uuid, uuid, text) from public, anon;

grant execute on function public.get_database_records(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.duplicate_database_structure(uuid, uuid, text) to authenticated, service_role;
