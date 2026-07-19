-- Atomically claim a reserved task upload. A function call is one PostgreSQL
-- transaction: any ownership, link, or metadata failure rolls every write back.

create or replace function public.claim_task_attachment(
  p_owner_id uuid,
  p_file_source_id uuid,
  p_task_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_metadata jsonb;
  v_existing_task_id uuid;
begin
  select fs.metadata_json
    into v_metadata
    from public.file_sources fs
   where fs.id = p_file_source_id
     and fs.user_id = p_owner_id
   for update;

  if not found then
    raise exception 'Attachment source not found or not owned.'
      using errcode = '42501';
  end if;

  if coalesce(v_metadata ->> 'source_kind', '') <> 'task-attachment' then
    raise exception 'Attachment source is not a task upload.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.tasks t
     where t.id = p_task_id
       and t.user_id = p_owner_id
  ) then
    raise exception 'Task not found or not owned.'
      using errcode = '42501';
  end if;

  select fl.target_id
    into v_existing_task_id
    from public.file_links fl
   where fl.file_source_id = p_file_source_id
     and fl.target_type = 'task'
   limit 1;

  if found then
    if v_existing_task_id <> p_task_id then
      raise exception 'Attachment source is already claimed by another task.'
        using errcode = '23505';
    end if;

    update public.file_sources
       set ingestion_status = 'pending',
           metadata_json = coalesce(metadata_json, '{}'::jsonb) ||
             jsonb_build_object(
               'cleanup_required', false,
               'task_attachment_state', 'claimed',
               'failure_stage', null,
               'failure_message', null,
               'claimed_task_id', p_task_id
             )
     where id = p_file_source_id
       and user_id = p_owner_id;
    return;
  end if;

  if coalesce(v_metadata ->> 'task_attachment_state', '') not in (
    'unclaimed',
    'cleanup_pending'
  ) or coalesce((v_metadata ->> 'cleanup_required')::boolean, false) is not true then
    raise exception 'Attachment source is not claimable.'
      using errcode = '22023';
  end if;

  insert into public.file_links (file_source_id, target_type, target_id)
  values (p_file_source_id, 'task', p_task_id);

  update public.file_sources
     set ingestion_status = 'pending',
         metadata_json = coalesce(metadata_json, '{}'::jsonb) ||
           jsonb_build_object(
             'cleanup_required', false,
             'task_attachment_state', 'claimed',
             'failure_stage', null,
             'failure_message', null,
             'claimed_task_id', p_task_id
           )
   where id = p_file_source_id
     and user_id = p_owner_id;

  if not found then
    raise exception 'Attachment source claim could not be persisted.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.claim_task_attachment(uuid, uuid, uuid) from public;
grant execute on function public.claim_task_attachment(uuid, uuid, uuid)
  to authenticated, service_role;
