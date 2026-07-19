-- F-45 starter workspace seed + F-10 atomic promote + F-12 full database duplicate
-- Spec: docs/superpowers/specs/2026-07-17-notion-workspace-fusion-design.md

drop function if exists public.create_starter_workspace(uuid, jsonb);
drop function if exists public.create_starter_workspace(uuid, jsonb, uuid);

-- ---------------------------------------------------------------------------
-- create_starter_workspace: one transaction from a client-built seed payload
-- ---------------------------------------------------------------------------

create or replace function public.create_starter_workspace(
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
  task_result jsonb;
  calendar_result jsonb;
  files_result jsonb;
  task_database_id uuid;
  calendar_database_id uuid;
  files_database_id uuid;
  title_property_id uuid;
  status_property_id uuid;
  getting_started_page_id uuid;
  notes_page_id uuid;
  task_el jsonb;
  created_record_id uuid;
  default_status text;
  pos double precision := 0;
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
  default_status := coalesce(nullif(btrim(p_seed ->> 'defaultStatusName'), ''), 'Not started');

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

  -- Face databases via F-11 RPC (properties + views)
  task_result := public.create_database_from_template(
    p_owner_id,
    created_workspace_id,
    coalesce(p_seed -> 'taskTemplate', '{}'::jsonb)
  );
  calendar_result := public.create_database_from_template(
    p_owner_id,
    created_workspace_id,
    coalesce(p_seed -> 'calendarTemplate', '{}'::jsonb)
  );
  files_result := public.create_database_from_template(
    p_owner_id,
    created_workspace_id,
    coalesce(p_seed -> 'filesTemplate', '{}'::jsonb)
  );

  task_database_id := (task_result ->> 'database_id')::uuid;
  calendar_database_id := (calendar_result ->> 'database_id')::uuid;
  files_database_id := (files_result ->> 'database_id')::uuid;
  title_property_id := (task_result ->> 'title_property_id')::uuid;

  select dp.id into status_property_id
  from public.database_properties dp
  where dp.database_id = task_database_id
    and coalesce(dp.config_json ->> 'role', '') = 'status'
  limit 1;

  -- Onboarding task records
  for task_el in
    select * from jsonb_array_elements(coalesce(p_seed -> 'onboardingTasks', '[]'::jsonb))
  loop
    insert into public.records (database_id, position, created_by, content_json)
    values (
      task_database_id,
      coalesce((task_el ->> 'position')::double precision, pos),
      p_owner_id,
      '{}'::jsonb
    )
    returning id into created_record_id;

    if title_property_id is not null then
      insert into public.record_values (record_id, property_id, value_json)
      values (
        created_record_id,
        title_property_id,
        to_jsonb(coalesce(task_el ->> 'title', 'Untitled'))
      );
    end if;

    if status_property_id is not null then
      insert into public.record_values (record_id, property_id, value_json)
      values (
        created_record_id,
        status_property_id,
        to_jsonb(coalesce(nullif(btrim(task_el ->> 'statusName'), ''), default_status))
      );
    end if;

    pos := pos + 1;
  end loop;

  update public.workspaces
  set settings_json = jsonb_build_object(
    'default_task_database_id', task_database_id,
    'default_calendar_database_id', calendar_database_id,
    'default_files_database_id', files_database_id,
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
    'notes_page_id', notes_page_id,
    'task_database_id', task_database_id,
    'calendar_database_id', calendar_database_id,
    'files_database_id', files_database_id
  );
end;
$$;

revoke all on function public.create_starter_workspace(uuid, jsonb, uuid) from public, anon;
grant execute on function public.create_starter_workspace(uuid, jsonb, uuid) to authenticated, service_role;

-- Ensure F-11 template RPC is executable (revoke-only in earlier migration)
grant execute on function public.create_database_from_template(uuid, uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- promote_blocks_to_records: atomic F-10 (records + page content patch)
-- p_blocks: [{ blockId, title, status?, priority?, dueDate? }, ...]
-- p_next_content: optional full content; when null, server removes source
--   blocks by id and inserts a database_view block at the first removed index
-- ---------------------------------------------------------------------------

create or replace function public.promote_blocks_to_records(
  p_owner_id uuid,
  p_page_id uuid,
  p_database_id uuid,
  p_blocks jsonb,
  p_next_content jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workspace_id uuid;
  block_el jsonb;
  title_property_id uuid;
  status_property_id uuid;
  priority_property_id uuid;
  due_property_id uuid;
  created_record_id uuid;
  record_ids uuid[] := array[]::uuid[];
  next_position double precision;
  current_content jsonb;
  next_content jsonb;
  source_ids text[] := array[]::text[];
  block_id text;
  kept jsonb := '[]'::jsonb;
  el jsonb;
  insert_index integer := -1;
  idx integer := 0;
  view_block jsonb;
  record_ids_csv text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  select p.workspace_id, coalesce(p.content_json, '[]'::jsonb)
  into workspace_id, current_content
  from public.pages p
  join public.workspaces w on w.id = p.workspace_id
  where p.id = p_page_id and w.owner_id = p_owner_id and p.is_archived = false;
  if workspace_id is null then
    raise exception 'page not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.databases d
    where d.id = p_database_id and d.workspace_id = workspace_id
  ) then
    raise exception 'database not found' using errcode = 'P0002';
  end if;

  select dp.id into title_property_id
  from public.database_properties dp
  where dp.database_id = p_database_id
    and (dp.is_primary = true or coalesce(dp.config_json ->> 'role', '') = 'title')
  order by dp.is_primary desc
  limit 1;

  if title_property_id is null then
    raise exception 'database is missing a title property' using errcode = 'P0002';
  end if;

  select dp.id into status_property_id
  from public.database_properties dp
  where dp.database_id = p_database_id and coalesce(dp.config_json ->> 'role', '') = 'status'
  limit 1;

  select dp.id into priority_property_id
  from public.database_properties dp
  where dp.database_id = p_database_id and coalesce(dp.config_json ->> 'role', '') = 'priority'
  limit 1;

  select dp.id into due_property_id
  from public.database_properties dp
  where dp.database_id = p_database_id and coalesce(dp.config_json ->> 'role', '') = 'due_date'
  limit 1;

  select coalesce(max(r.position), -1) + 1 into next_position
  from public.records r
  where r.database_id = p_database_id and r.deleted_at is null;

  for block_el in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb))
  loop
    if nullif(btrim(block_el ->> 'title'), '') is null then
      continue;
    end if;

    block_id := nullif(block_el ->> 'blockId', '');
    if block_id is not null then
      source_ids := array_append(source_ids, block_id);
    end if;

    insert into public.records (
      database_id, position, created_by, source_block_id, content_json
    )
    values (
      p_database_id,
      next_position,
      p_owner_id,
      block_id,
      '{}'::jsonb
    )
    returning id into created_record_id;

    record_ids := array_append(record_ids, created_record_id);
    next_position := next_position + 1;

    insert into public.record_values (record_id, property_id, value_json)
    values (created_record_id, title_property_id, to_jsonb(btrim(block_el ->> 'title')));

    if status_property_id is not null and nullif(btrim(block_el ->> 'status'), '') is not null then
      insert into public.record_values (record_id, property_id, value_json)
      values (created_record_id, status_property_id, to_jsonb(btrim(block_el ->> 'status')));
    end if;

    if priority_property_id is not null and nullif(btrim(block_el ->> 'priority'), '') is not null then
      insert into public.record_values (record_id, property_id, value_json)
      values (created_record_id, priority_property_id, to_jsonb(btrim(block_el ->> 'priority')));
    end if;

    if due_property_id is not null and nullif(btrim(block_el ->> 'dueDate'), '') is not null then
      insert into public.record_values (record_id, property_id, value_json)
      values (created_record_id, due_property_id, to_jsonb(btrim(block_el ->> 'dueDate')));
    end if;
  end loop;

  if p_next_content is not null then
    next_content := p_next_content;
  else
    record_ids_csv := array_to_string(record_ids, ',');
    view_block := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'database_view',
      'props', jsonb_build_object(
        'databaseId', p_database_id::text,
        'viewId', '',
        'filterKey', '',
        'recordIds', record_ids_csv
      ),
      'content', '[]'::jsonb,
      'children', '[]'::jsonb
    );

    for el in select * from jsonb_array_elements(
      case when jsonb_typeof(current_content) = 'array' then current_content else '[]'::jsonb end
    )
    loop
      if (el ->> 'id') = any (source_ids) then
        if insert_index < 0 then
          insert_index := idx;
          kept := kept || jsonb_build_array(view_block);
        end if;
      else
        kept := kept || jsonb_build_array(el);
      end if;
      idx := idx + 1;
    end loop;

    if insert_index < 0 and coalesce(array_length(record_ids, 1), 0) > 0 then
      kept := kept || jsonb_build_array(view_block);
    end if;

    next_content := kept;
  end if;

  update public.pages
  set content_json = next_content,
      updated_at = now()
  where id = p_page_id;

  return jsonb_build_object(
    'database_id', p_database_id,
    'record_ids', to_jsonb(record_ids),
    'page_id', p_page_id,
    'content_json', next_content
  );
end;
$$;

revoke all on function public.promote_blocks_to_records(uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.promote_blocks_to_records(uuid, uuid, uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- duplicate_database_with_records: F-12 full copy (structure + records)
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_database_with_records(
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
  structure jsonb;
  created_database_id uuid;
  property_id_map jsonb := '{}'::jsonb;
  source_property public.database_properties;
  dest_property public.database_properties;
  source_record public.records;
  new_record_id uuid;
  copied_count integer := 0;
begin
  structure := public.duplicate_database_structure(p_owner_id, p_database_id, p_name);
  created_database_id := (structure ->> 'database_id')::uuid;

  -- Remap property ids by name+position between source and dest
  for source_property in
    select * from public.database_properties
    where database_id = p_database_id
    order by position asc
  loop
    select * into dest_property
    from public.database_properties
    where database_id = created_database_id
      and name = source_property.name
      and position = source_property.position
    limit 1;
    if dest_property.id is not null then
      property_id_map := property_id_map || jsonb_build_object(
        source_property.id::text,
        dest_property.id::text
      );
    end if;
  end loop;

  for source_record in
    select * from public.records
    where database_id = p_database_id and deleted_at is null
    order by position asc
  loop
    insert into public.records (
      database_id, position, content_json, source_block_id, created_by
    )
    values (
      created_database_id,
      source_record.position,
      source_record.content_json,
      null,
      p_owner_id
    )
    returning id into new_record_id;

    copied_count := copied_count + 1;

    insert into public.record_values (record_id, property_id, value_json)
    select
      new_record_id,
      (property_id_map ->> rv.property_id::text)::uuid,
      rv.value_json
    from public.record_values rv
    where rv.record_id = source_record.id
      and property_id_map ? rv.property_id::text;
  end loop;

  return structure || jsonb_build_object('copied_record_count', copied_count);
end;
$$;

revoke all on function public.duplicate_database_with_records(uuid, uuid, text) from public, anon;
grant execute on function public.duplicate_database_with_records(uuid, uuid, text) to authenticated, service_role;
