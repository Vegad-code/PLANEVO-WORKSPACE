-- Workspace kernel v2: record pages, soft delete, fractional positions, workspace settings.
-- F-06 record content_json, F-10 source_block_id, F-02 fractional page ordering.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.records
  add column if not exists content_json jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists source_block_id text;

alter table public.pages
  alter column position type double precision using position::double precision;

alter table public.records
  alter column position type double precision using position::double precision;

alter table public.workspaces
  add column if not exists settings_json jsonb not null default '{}'::jsonb;

create index if not exists records_database_active_idx
  on public.records (database_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- get_database_records: exclude soft-deleted rows; position is double precision
-- ---------------------------------------------------------------------------

drop function if exists public.get_database_records(uuid, integer, integer);

create or replace function public.get_database_records(
  p_database_id uuid,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  record_id uuid,
  record_position double precision,
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
    and r.deleted_at is null
  group by r.id
  order by r.position asc, r.created_at asc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------------------------------------------------------------------------
-- create_database_from_template: single transaction from JSON spec (F-03/F-11)
-- Spec shape matches packages/core/src/defaults/database-templates.ts
-- ---------------------------------------------------------------------------

create or replace function public.create_database_from_template(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_template jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  db_name text;
  db_icon text;
  template_type text;
  create_page boolean;
  parent_page_id uuid;
  created_page_id uuid;
  created_database_id uuid;
  property_el jsonb;
  view_el jsonb;
  property_id uuid;
  property_ids jsonb := '{}'::jsonb;
  role_name text;
  status_property_id uuid;
  due_property_id uuid;
  group_role text;
  date_role text;
  new_config jsonb;
  pos integer := 0;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p_owner_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  db_name := coalesce(nullif(btrim(p_template ->> 'name'), ''), 'Untitled');
  db_icon := p_template ->> 'icon';
  template_type := coalesce(p_template ->> 'templateType', 'custom');
  create_page := coalesce((p_template ->> 'createPage')::boolean, true);
  parent_page_id := (p_template ->> 'parentPageId')::uuid;

  if create_page then
    insert into public.pages (workspace_id, parent_page_id, title, icon, position)
    values (
      p_workspace_id,
      parent_page_id,
      db_name,
      db_icon,
      coalesce((p_template ->> 'pagePosition')::double precision, 0)
    )
    returning id into created_page_id;
  else
    created_page_id := (p_template ->> 'pageId')::uuid;
  end if;

  insert into public.databases (workspace_id, page_id, name, icon, template_type)
  values (p_workspace_id, created_page_id, db_name, db_icon, template_type)
  returning id into created_database_id;

  if created_page_id is not null then
    update public.pages set database_id = created_database_id where id = created_page_id;
  end if;

  for property_el in select * from jsonb_array_elements(coalesce(p_template -> 'properties', '[]'::jsonb))
  loop
    insert into public.database_properties (
      database_id, name, type, position, is_primary, config_json
    )
    values (
      created_database_id,
      property_el ->> 'name',
      property_el ->> 'type',
      coalesce((property_el ->> 'position')::integer, pos),
      coalesce((property_el ->> 'isPrimary')::boolean, false),
      coalesce(property_el -> 'config', '{}'::jsonb)
    )
    returning id into property_id;

    role_name := property_el -> 'config' ->> 'role';
    if role_name is not null and role_name <> '' then
      property_ids := property_ids || jsonb_build_object(role_name, property_id);
    end if;

    if coalesce((property_el ->> 'isPrimary')::boolean, false) then
      property_ids := property_ids || jsonb_build_object('title', property_id);
    end if;

    pos := pos + 1;
  end loop;

  status_property_id := (property_ids ->> 'status')::uuid;
  due_property_id := (property_ids ->> 'due_date')::uuid;

  pos := 0;
  for view_el in select * from jsonb_array_elements(coalesce(p_template -> 'views', '[]'::jsonb))
  loop
    new_config := coalesce(view_el -> 'config', '{}'::jsonb);
    group_role := view_el -> 'config' ->> 'groupByRole';
    if group_role is not null and group_role <> '' then
      new_config := new_config || jsonb_build_object(
        'group_by_property_id', (property_ids ->> group_role)::uuid
      );
    end if;
    date_role := view_el -> 'config' ->> 'dateRole';
    if date_role is not null and date_role <> '' then
      new_config := new_config || jsonb_build_object(
        'date_property_id', (property_ids ->> date_role)::uuid
      );
    end if;
    new_config := new_config - 'groupByRole' - 'dateRole';

    insert into public.views (database_id, type, name, config_json, position, is_default)
    values (
      created_database_id,
      view_el ->> 'type',
      view_el ->> 'name',
      new_config,
      coalesce((view_el ->> 'position')::integer, pos),
      coalesce((view_el ->> 'isDefault')::boolean, false)
    );
    pos := pos + 1;
  end loop;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'page_id', created_page_id,
    'database_id', created_database_id,
    'title_property_id', property_ids ->> 'title'
  );
end;
$$;

revoke all on function public.create_database_from_template(uuid, uuid, jsonb) from public, anon;
