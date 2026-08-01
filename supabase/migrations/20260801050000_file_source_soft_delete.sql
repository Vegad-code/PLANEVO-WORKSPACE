-- Soft-delete for Files product rows so multi-delete can offer a real Restore
-- toast. Storage blobs stay until purge_after; hard cleanup is deferred.

alter table public.file_sources
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz;

alter table public.file_sources
  drop constraint if exists file_sources_trash_window_check;

alter table public.file_sources
  add constraint file_sources_trash_window_check check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after is not null)
  ) not valid;

alter table public.file_sources
  validate constraint file_sources_trash_window_check;

create index if not exists file_sources_user_active_created_idx
  on public.file_sources (user_id, created_at desc)
  where deleted_at is null;

create index if not exists file_sources_purge_after_idx
  on public.file_sources (purge_after)
  where purge_after is not null;

-- Soft-delete: hide from library, keep row + blobs restorable until purge.
create or replace function public.delete_file_document(
  p_owner_id uuid,
  p_file_source_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_page_id uuid;
  v_deleted_at timestamptz;
  v_purge_after timestamptz;
begin
  if current_user <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    source.workspace_id,
    source.page_id,
    source.deleted_at,
    source.purge_after
  into v_workspace_id, v_page_id, v_deleted_at, v_purge_after
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
  for update;

  if v_workspace_id is null then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return jsonb_build_object(
      'workspaceId', v_workspace_id,
      'pageId', v_page_id,
      'deletedAt', v_deleted_at,
      'purgeAfter', v_purge_after,
      'restorable', true,
      'alreadyDeleted', true
    );
  end if;

  delete from public.recent_items
  where user_id = p_owner_id
    and workspace_id = v_workspace_id
    and (
      (target_type = 'file' and target_id = p_file_source_id)
      or (v_page_id is not null and target_type = 'page' and target_id = v_page_id)
    );

  update public.file_sources
  set
    deleted_at = now(),
    purge_after = now() + interval '30 days',
    updated_at = now()
  where id = p_file_source_id
    and user_id = p_owner_id
    and deleted_at is null
  returning deleted_at, purge_after into v_deleted_at, v_purge_after;

  return jsonb_build_object(
    'workspaceId', v_workspace_id,
    'pageId', v_page_id,
    'deletedAt', v_deleted_at,
    'purgeAfter', v_purge_after,
    'restorable', true,
    'alreadyDeleted', false
  );
end;
$$;

revoke all on function public.delete_file_document(uuid, uuid)
  from public, anon;
grant execute on function public.delete_file_document(uuid, uuid)
  to authenticated, service_role;

-- Undo a soft-delete while still inside the restore window.
create or replace function public.restore_file_document(
  p_owner_id uuid,
  p_file_source_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.file_sources;
begin
  if current_user <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select *
  into v_row
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
  for update;

  if not found then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  if v_row.deleted_at is null then
    return jsonb_build_object(
      'fileSourceId', v_row.id,
      'restored', false,
      'alreadyActive', true
    );
  end if;

  if v_row.purge_after is not null and v_row.purge_after <= now() then
    raise exception 'restore window expired' using errcode = 'P0001';
  end if;

  update public.file_sources
  set
    deleted_at = null,
    purge_after = null,
    updated_at = now()
  where id = v_row.id
    and user_id = p_owner_id
    and deleted_at is not null
  returning * into v_row;

  return jsonb_build_object(
    'fileSourceId', v_row.id,
    'restored', true,
    'alreadyActive', false
  );
end;
$$;

revoke all on function public.restore_file_document(uuid, uuid)
  from public, anon;
grant execute on function public.restore_file_document(uuid, uuid)
  to authenticated, service_role;

-- Hard-delete one soft-deleted file whose purge window has elapsed.
-- Keeps storage cleanup queue behaviour from the previous delete path.
create or replace function public.purge_file_document(
  p_owner_id uuid,
  p_file_source_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_page_id uuid;
  v_storage_path text;
  v_storage_kind text;
  v_deleted_at timestamptz;
  v_purge_after timestamptz;
  v_storage_paths text[];
  v_cleanup_job_id uuid;
begin
  if current_user <> 'service_role'
    and (select auth.uid()) is distinct from p_owner_id
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select
    source.workspace_id,
    source.page_id,
    source.storage_path,
    source.storage_kind,
    source.deleted_at,
    source.purge_after
  into
    v_workspace_id,
    v_page_id,
    v_storage_path,
    v_storage_kind,
    v_deleted_at,
    v_purge_after
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
  for update;

  if v_workspace_id is null then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  if v_deleted_at is null then
    raise exception 'file is not deleted' using errcode = 'P0001';
  end if;

  if v_purge_after is not null and v_purge_after > now() then
    raise exception 'purge window has not elapsed' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct revision.storage_path), '{}'::text[])
  into v_storage_paths
  from public.file_revisions revision
  where revision.file_source_id = p_file_source_id
    and revision.user_id = p_owner_id
    and revision.storage_path not like 'local:%';

  if
    v_storage_kind <> 'local'
    and v_storage_path is not null
    and v_storage_path not like 'page:%'
    and v_storage_path not like 'local:%'
  then
    v_storage_paths := array_append(v_storage_paths, v_storage_path);
  end if;

  if cardinality(v_storage_paths) > 0 then
    insert into public.file_storage_cleanup_jobs (
      user_id, storage_paths
    ) values (
      p_owner_id, v_storage_paths
    ) returning id into v_cleanup_job_id;
  end if;

  delete from public.recent_items
  where user_id = p_owner_id
    and workspace_id = v_workspace_id
    and (
      (target_type = 'file' and target_id = p_file_source_id)
      or (v_page_id is not null and target_type = 'page' and target_id = v_page_id)
    );

  delete from public.file_sources
  where id = p_file_source_id and user_id = p_owner_id;

  if v_page_id is not null and v_storage_path like 'page:%' then
    delete from public.pages
    where id = v_page_id and workspace_id = v_workspace_id;
  end if;

  return jsonb_build_object(
    'workspaceId', v_workspace_id,
    'pageId', v_page_id,
    'cleanupJobId', v_cleanup_job_id,
    'storagePaths', to_jsonb(v_storage_paths)
  );
end;
$$;

revoke all on function public.purge_file_document(uuid, uuid)
  from public, anon;
grant execute on function public.purge_file_document(uuid, uuid)
  to authenticated, service_role;
