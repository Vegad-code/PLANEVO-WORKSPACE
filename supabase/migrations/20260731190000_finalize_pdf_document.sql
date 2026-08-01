-- PDF saves reuse the staged-object compare-and-swap used by markdown/text/DOCX
-- so a failed concurrent save never overwrites the canonical object. The file
-- source remains the same Files entry; only its immutable backing version advances.
-- Founder applies this by hand on project aixvpsmpiucticxutngp — agents must not
-- run supabase db push / Docker / Management API apply for this migration.
create or replace function public.finalize_file_text_document(
  p_owner_id uuid,
  p_file_source_id uuid,
  p_base_version bigint,
  p_storage_path text,
  p_size_bytes bigint,
  p_content_hash text,
  p_format text,
  p_encoding_json jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_storage_path text;
  v_workspace_id uuid;
  v_current_version bigint;
  v_next_version bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_format not in ('markdown', 'text', 'docx', 'pdf') then
    raise exception 'unsupported editable document format' using errcode = '22023';
  end if;
  if p_format = 'docx' and p_encoding_json is distinct from '{}'::jsonb then
    raise exception 'DOCX documents cannot carry text encoding metadata'
      using errcode = '22023';
  end if;
  if p_format = 'pdf' and p_encoding_json is distinct from '{}'::jsonb then
    raise exception 'PDF documents cannot carry text encoding metadata'
      using errcode = '22023';
  end if;
  if p_size_bytes < 0 or p_size_bytes > 26214400 then
    raise exception 'invalid document byte size' using errcode = '22023';
  end if;
  if p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid document content hash' using errcode = '22023';
  end if;

  select source.storage_path, source.workspace_id
  into v_previous_storage_path, v_workspace_id
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
    and source.page_id is null
  for update;

  if v_previous_storage_path is null then
    raise exception 'file not found' using errcode = 'P0002';
  end if;
  if p_storage_path not like (
    v_workspace_id::text || '/edits/' || p_file_source_id::text || '/%'
  ) then
    raise exception 'invalid staged document path' using errcode = '22023';
  end if;

  insert into public.file_document_state (
    file_source_id, user_id, format, current_version
  ) values (
    p_file_source_id, p_owner_id, p_format, 0
  ) on conflict (file_source_id) do nothing;

  select state.current_version
  into v_current_version
  from public.file_document_state state
  where state.file_source_id = p_file_source_id
  for update;

  if v_current_version is distinct from p_base_version then
    raise exception 'document version conflict'
      using errcode = 'P0001',
            detail = jsonb_build_object('currentVersion', v_current_version)::text;
  end if;

  v_next_version := v_current_version + 1;

  update public.file_sources
  set storage_path = p_storage_path,
      size_bytes = p_size_bytes,
      ingestion_status = 'ready',
      updated_at = now()
  where id = p_file_source_id;

  update public.file_document_state
  set current_version = v_next_version,
      content_hash = p_content_hash,
      format = p_format,
      encoding_json = p_encoding_json
  where file_source_id = p_file_source_id;

  return jsonb_build_object(
    'version', v_next_version,
    'contentHash', p_content_hash,
    'previousStoragePath', v_previous_storage_path
  );
end;
$$;

revoke all on function public.finalize_file_text_document(
  uuid, uuid, bigint, text, bigint, text, text, jsonb
) from public, anon;
grant execute on function public.finalize_file_text_document(
  uuid, uuid, bigint, text, bigint, text, text, jsonb
) to authenticated, service_role;
