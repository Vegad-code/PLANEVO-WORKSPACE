-- Local-first Files metadata. Local content never enters Storage, revisions,
-- source_chunks, or cleanup queues until the owner explicitly promotes it.

alter table public.file_sources
  add column if not exists storage_kind text not null default 'cloud';

alter table public.file_sources
  drop constraint if exists file_sources_storage_kind_check;
alter table public.file_sources
  add constraint file_sources_storage_kind_check
  check (storage_kind in ('local', 'synced', 'cloud', 'page'));

update public.file_sources
set storage_kind = 'page'
where page_id is not null or storage_path like 'page:%';

alter table public.file_sources
  drop constraint if exists file_sources_ingestion_status_check;
alter table public.file_sources
  add constraint file_sources_ingestion_status_check
  check (
    ingestion_status in (
      'local_only',
      'pending',
      'processing',
      'ready',
      'failed'
    )
  );

create index if not exists file_sources_user_storage_kind_idx
  on public.file_sources (user_id, storage_kind, created_at desc);

comment on column public.file_sources.storage_kind is
  'local keeps content on-device; synced is an opted-in local source copied to Storage; cloud is uploaded; page is a Planevo document.';

create or replace function public.prevent_local_file_chunks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_storage_kind text;
begin
  select source.storage_kind
  into v_storage_kind
  from public.file_sources source
  where source.id = new.file_source_id;

  if v_storage_kind = 'local' then
    raise exception 'local-only files cannot create server search chunks'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists source_chunks_reject_local_files
  on public.source_chunks;
create trigger source_chunks_reject_local_files
  before insert or update on public.source_chunks
  for each row execute function public.prevent_local_file_chunks();

revoke all on function public.prevent_local_file_chunks()
  from public, anon, authenticated;

-- The document-workspace migration creates this function. Re-declare it so a
-- local virtual path is never sent to a Storage cleanup worker.
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
  v_storage_path text;
  v_storage_kind text;
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
    source.storage_kind
  into v_workspace_id, v_page_id, v_storage_path, v_storage_kind
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
  for update;

  if v_workspace_id is null then
    raise exception 'file not found' using errcode = 'P0002';
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

revoke all on function public.delete_file_document(uuid, uuid)
  from public, anon;
grant execute on function public.delete_file_document(uuid, uuid)
  to authenticated, service_role;
