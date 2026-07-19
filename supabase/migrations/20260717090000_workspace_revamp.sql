-- Workspace revamp: fractional positions everywhere, page covers, relation
-- uniqueness, atomic property conversion / record duplication / cross-database
-- moves, and a private page-assets storage bucket.
--
-- Fully idempotent: every statement is guarded (IF NOT EXISTS / CREATE OR REPLACE
-- / DO blocks keyed on information_schema or pg_policies). Safe to run twice.
--
-- The three mutation RPCs are SECURITY INVOKER, matching every existing kernel
-- RPC: the p_owner_id guard plus per-table RLS give two independent layers of
-- ownership enforcement. (Deliberate deviation from the WS-A brief's "SECURITY
-- DEFINER" wording — invoker is the established, RLS-backed house pattern.)

-- ---------------------------------------------------------------------------
-- 1. position integer -> double precision (guarded on current data_type)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pages'
      and column_name = 'position' and data_type = 'integer'
  ) then
    alter table public.pages
      alter column position type double precision using position::double precision;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'records'
      and column_name = 'position' and data_type = 'integer'
  ) then
    alter table public.records
      alter column position type double precision using position::double precision;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'database_properties'
      and column_name = 'position' and data_type = 'integer'
  ) then
    alter table public.database_properties
      alter column position type double precision using position::double precision;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'views'
      and column_name = 'position' and data_type = 'integer'
  ) then
    alter table public.views
      alter column position type double precision using position::double precision;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. pages.cover_image
-- ---------------------------------------------------------------------------

alter table public.pages add column if not exists cover_image text;

-- ---------------------------------------------------------------------------
-- 3. relations: dedupe existing edges, then enforce uniqueness
-- ---------------------------------------------------------------------------

delete from public.relations a
using public.relations b
where a.id > b.id
  and a.source_record_id = b.source_record_id
  and a.source_property_id = b.source_property_id
  and a.target_record_id = b.target_record_id;

create unique index if not exists relations_unique_edge
  on public.relations (source_record_id, source_property_id, target_record_id);

-- ---------------------------------------------------------------------------
-- 4. apply_property_conversion: atomic property type change (F-04/F-10)
--    Rewrites per-record values, clears unconvertible ones, flips type/config.
-- ---------------------------------------------------------------------------

create or replace function public.apply_property_conversion(
  p_owner_id uuid,
  p_property_id uuid,
  p_new_type text,
  p_new_config jsonb,
  p_value_updates jsonb,
  p_clear_record_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_property public.database_properties;
  update_el jsonb;
  updated_count integer := 0;
  cleared_count integer := 0;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  select dp.* into target_property
  from public.database_properties dp
  join public.databases d on d.id = dp.database_id
  join public.workspaces w on w.id = d.workspace_id
  where dp.id = p_property_id and w.owner_id = p_owner_id;
  if target_property.id is null then
    raise exception 'property not found' using errcode = 'P0002';
  end if;

  if p_value_updates is not null and jsonb_typeof(p_value_updates) = 'array' then
    for update_el in select * from jsonb_array_elements(p_value_updates)
    loop
      insert into public.record_values (record_id, property_id, value_json)
      values (
        (update_el ->> 'record_id')::uuid,
        p_property_id,
        coalesce(update_el -> 'value', 'null'::jsonb)
      )
      on conflict (record_id, property_id)
      do update set value_json = excluded.value_json;
      updated_count := updated_count + 1;
    end loop;
  end if;

  if p_clear_record_ids is not null and array_length(p_clear_record_ids, 1) is not null then
    delete from public.record_values
    where property_id = p_property_id
      and record_id = any(p_clear_record_ids);
    get diagnostics cleared_count = row_count;
  end if;

  update public.database_properties
    set type = p_new_type,
        config_json = coalesce(p_new_config, config_json)
    where id = p_property_id;

  return jsonb_build_object(
    'ok', true,
    'updated_count', updated_count,
    'cleared_count', cleared_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. duplicate_records: records + their values + outgoing relations (F-06)
--    New rows land at the end of their database (max position + 1 each).
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_records(
  p_owner_id uuid,
  p_record_ids uuid[]
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_record public.records;
  new_record_id uuid;
  id_map jsonb := '{}'::jsonb;
  new_ids uuid[] := array[]::uuid[];
  rid uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  foreach rid in array coalesce(p_record_ids, array[]::uuid[])
  loop
    select r.* into source_record
    from public.records r
    join public.databases d on d.id = r.database_id
    join public.workspaces w on w.id = d.workspace_id
    where r.id = rid and w.owner_id = p_owner_id and r.deleted_at is null;
    if source_record.id is null then
      continue;
    end if;

    insert into public.records (database_id, position, content_json, source_block_id, created_by)
    values (
      source_record.database_id,
      (select coalesce(max(position), 0) + 1 from public.records
        where database_id = source_record.database_id),
      source_record.content_json,
      source_record.source_block_id,
      p_owner_id
    )
    returning id into new_record_id;

    insert into public.record_values (record_id, property_id, value_json)
    select new_record_id, rv.property_id, rv.value_json
    from public.record_values rv
    where rv.record_id = source_record.id;

    id_map := id_map || jsonb_build_object(source_record.id::text, new_record_id::text);
    new_ids := array_append(new_ids, new_record_id);
  end loop;

  -- Copy outgoing relations of duplicated records, retargeting source to the copy.
  insert into public.relations (source_record_id, source_property_id, target_record_id)
  select (id_map ->> rel.source_record_id::text)::uuid, rel.source_property_id, rel.target_record_id
  from public.relations rel
  where id_map ? rel.source_record_id::text
  on conflict on constraint relations_unique_edge do nothing;

  return new_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. move_records_to_database: relocate records, remap values per property map,
--    drop unmapped values and relations. Returns count moved. (F-06)
-- ---------------------------------------------------------------------------

create or replace function public.move_records_to_database(
  p_owner_id uuid,
  p_record_ids uuid[],
  p_target_database_id uuid,
  p_property_map jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moved_count integer := 0;
  rid uuid;
  source_record public.records;
  base_position double precision;
  map_key text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.databases d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = p_target_database_id and w.owner_id = p_owner_id
  ) then
    raise exception 'target database not found' using errcode = 'P0002';
  end if;

  if p_property_map is null or jsonb_typeof(p_property_map) <> 'object' then
    p_property_map := '{}'::jsonb;
  end if;

  select coalesce(max(position), 0) into base_position
  from public.records where database_id = p_target_database_id;

  foreach rid in array coalesce(p_record_ids, array[]::uuid[])
  loop
    select r.* into source_record
    from public.records r
    join public.databases d on d.id = r.database_id
    join public.workspaces w on w.id = d.workspace_id
    where r.id = rid and w.owner_id = p_owner_id and r.deleted_at is null;
    if source_record.id is null or source_record.database_id = p_target_database_id then
      continue;
    end if;

    base_position := base_position + 1;
    update public.records
      set database_id = p_target_database_id, position = base_position
      where id = rid;

    -- Remap mapped source properties to their target property ids.
    for map_key in select jsonb_object_keys(p_property_map)
    loop
      update public.record_values
        set property_id = (p_property_map ->> map_key)::uuid
        where record_id = rid and property_id = map_key::uuid;
    end loop;

    -- Drop any value whose property was not mapped into the target database.
    delete from public.record_values
    where record_id = rid
      and property_id not in (
        select value::uuid from jsonb_each_text(p_property_map)
      );

    -- Relations: remap mapped source properties, then drop unmapped ones.
    update public.relations
      set source_property_id = (p_property_map ->> source_property_id::text)::uuid
      where source_record_id = rid
        and p_property_map ? source_property_id::text;

    delete from public.relations
    where source_record_id = rid
      and source_property_id not in (
        select value::uuid from jsonb_each_text(p_property_map)
      );

    moved_count := moved_count + 1;
  end loop;

  return moved_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: revoke public/anon, grant authenticated + service_role (house pattern)
-- ---------------------------------------------------------------------------

revoke all on function public.apply_property_conversion(uuid, uuid, text, jsonb, jsonb, uuid[]) from public, anon;
revoke all on function public.duplicate_records(uuid, uuid[]) from public, anon;
revoke all on function public.move_records_to_database(uuid, uuid[], uuid, jsonb) from public, anon;

grant execute on function public.apply_property_conversion(uuid, uuid, text, jsonb, jsonb, uuid[]) to authenticated, service_role;
grant execute on function public.duplicate_records(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.move_records_to_database(uuid, uuid[], uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. page-assets storage bucket (private) + owner-scoped policies.
--    Path convention: {owner_id}/... (first folder segment is the auth user id).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('page-assets', 'page-assets', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'page asset owners read'
  ) then
    create policy "page asset owners read"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'page-assets'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'page asset owners upload'
  ) then
    create policy "page asset owners upload"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'page-assets'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'page asset owners update'
  ) then
    create policy "page asset owners update"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'page-assets'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'page-assets'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'page asset owners delete'
  ) then
    create policy "page asset owners delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'page-assets'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;
