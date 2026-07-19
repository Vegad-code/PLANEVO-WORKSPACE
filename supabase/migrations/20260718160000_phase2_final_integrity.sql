-- Phase 2 final hardening: ownership, idempotency, locked lifecycle/order,
-- and transactional task deletion. Additive follow-up; do not rewrite applied SQL.

alter table public.file_sources add column if not exists operation_key uuid;
alter table public.file_sources add column if not exists reservation_expires_at timestamptz;
alter table public.tasks add column if not exists operation_key uuid;
alter table public.calendar_events add column if not exists operation_key uuid;
alter table public.file_links add column if not exists operation_key uuid;

update public.file_sources set user_id = created_by where user_id is distinct from created_by;
alter table public.file_sources alter column user_id set not null;
alter table public.file_sources drop constraint if exists file_sources_owner_consistent;
alter table public.file_sources add constraint file_sources_owner_consistent check (user_id = created_by) not valid;
alter table public.file_sources validate constraint file_sources_owner_consistent;

create unique index if not exists tasks_owner_operation_key_uidx on public.tasks (user_id, operation_key) where operation_key is not null;
create unique index if not exists calendar_events_owner_operation_key_uidx on public.calendar_events (user_id, operation_key) where operation_key is not null;
create unique index if not exists file_sources_owner_operation_key_uidx on public.file_sources (user_id, operation_key) where operation_key is not null;
create unique index if not exists file_links_owner_operation_key_uidx on public.file_links (file_source_id, operation_key) where operation_key is not null;
create index if not exists file_sources_reservation_expiry_idx on public.file_sources (user_id, reservation_expires_at) where reservation_expires_at is not null;

drop policy if exists calendar_events_owner on public.calendar_events;
create policy calendar_events_both_endpoints on public.calendar_events for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.calendars c where c.id = calendar_id and c.user_id = (select auth.uid()))
  and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.calendars c where c.id = calendar_id and c.user_id = (select auth.uid()))
  and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())))
);

drop policy if exists workspace_links_via_workspace on public.workspace_links;
create policy workspace_links_both_endpoints on public.workspace_links for all to authenticated
using (
  created_by = (select auth.uid()) and public.is_workspace_owner(workspace_id) and (
    (resource_type = 'task' and exists (select 1 from public.tasks t where t.id = resource_id and t.user_id = (select auth.uid())))
    or (resource_type = 'calendar_event' and exists (select 1 from public.calendar_events e where e.id = resource_id and e.user_id = (select auth.uid())))
    or (resource_type = 'file' and exists (select 1 from public.file_sources fs where fs.id = resource_id and fs.user_id = (select auth.uid())))
  )
)
with check (
  created_by = (select auth.uid()) and public.is_workspace_owner(workspace_id) and (
    (resource_type = 'task' and exists (select 1 from public.tasks t where t.id = resource_id and t.user_id = (select auth.uid())))
    or (resource_type = 'calendar_event' and exists (select 1 from public.calendar_events e where e.id = resource_id and e.user_id = (select auth.uid())))
    or (resource_type = 'file' and exists (select 1 from public.file_sources fs where fs.id = resource_id and fs.user_id = (select auth.uid())))
  )
);

drop policy if exists file_links_via_file_source on public.file_links;
create policy file_links_both_endpoints on public.file_links for all to authenticated
using (
  exists (select 1 from public.file_sources fs where fs.id = file_source_id and fs.user_id = (select auth.uid()))
  and ((target_type = 'task' and exists (select 1 from public.tasks t where t.id = target_id and t.user_id = (select auth.uid())))
    or (target_type = 'calendar_event' and exists (select 1 from public.calendar_events e where e.id = target_id and e.user_id = (select auth.uid()))))
)
with check (
  exists (select 1 from public.file_sources fs where fs.id = file_source_id and fs.user_id = (select auth.uid()))
  and ((target_type = 'task' and exists (select 1 from public.tasks t where t.id = target_id and t.user_id = (select auth.uid())))
    or (target_type = 'calendar_event' and exists (select 1 from public.calendar_events e where e.id = target_id and e.user_id = (select auth.uid()))))
);

create or replace function public.reserve_task_attachment(
  p_owner_id uuid, p_workspace_id uuid, p_operation_key uuid, p_storage_path text,
  p_name text, p_mime_type text, p_size_bytes bigint, p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_source public.file_sources;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_workspace_owner(p_workspace_id) or p_size_bytes <= 0 or p_expires_at <= now() then raise exception 'invalid reservation' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 1701));
  select * into v_source from public.file_sources where user_id = p_owner_id and operation_key = p_operation_key for update;
  if found then
    return jsonb_build_object('id', v_source.id, 'storage_path', v_source.storage_path, 'expires_at', v_source.reservation_expires_at, 'created', false);
  end if;
  if (select count(*) from public.file_sources where user_id = p_owner_id and reservation_expires_at > now() and coalesce(metadata_json->>'task_attachment_state','') in ('unclaimed','cleanup_pending')) >= 20 then
    raise exception 'attachment reservation quota reached' using errcode = '54000';
  end if;
  insert into public.file_sources(workspace_id,created_by,user_id,storage_path,name,mime_type,size_bytes,ingestion_status,operation_key,reservation_expires_at,metadata_json)
  values(p_workspace_id,p_owner_id,p_owner_id,p_storage_path,p_name,nullif(p_mime_type,''),p_size_bytes,'pending',p_operation_key,p_expires_at,
    jsonb_build_object('source_kind','task-attachment','bucket','workspace-files','path',p_storage_path,'cleanup_required',true,'task_attachment_state','unclaimed','failure_stage',null,'reserved_at',now(),'expires_at',p_expires_at))
  returning * into v_source;
  return jsonb_build_object('id', v_source.id, 'storage_path', v_source.storage_path, 'expires_at', v_source.reservation_expires_at, 'created', true);
end; $$;

create or replace function public.begin_task_attachment_cleanup(p_owner_id uuid,p_file_source_id uuid,p_storage_path text,p_failure_stage text default null,p_failure_message text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_metadata jsonb;
begin
  select metadata_json into v_metadata from public.file_sources where id=p_file_source_id and user_id=p_owner_id and storage_path=p_storage_path for update;
  if not found then return false; end if;
  if coalesce(v_metadata->>'source_kind','') <> 'task-attachment' or coalesce(v_metadata->>'task_attachment_state','') not in ('unclaimed','cleanup_pending')
    or exists(select 1 from public.file_links where file_source_id=p_file_source_id) then raise exception 'attachment is not cleanup eligible' using errcode='55000'; end if;
  update public.file_sources set ingestion_status='failed', metadata_json=coalesce(metadata_json,'{}'::jsonb)||jsonb_build_object('cleanup_required',true,'task_attachment_state','cleanup_pending','failure_stage',p_failure_stage,'failure_message',p_failure_message)
  where id=p_file_source_id;
  return true;
end; $$;

create or replace function public.finalize_task_attachment_cleanup(p_owner_id uuid,p_file_source_id uuid,p_storage_path text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_metadata jsonb;
begin
  select metadata_json into v_metadata from public.file_sources where id=p_file_source_id and user_id=p_owner_id and storage_path=p_storage_path for update;
  if not found then return true; end if;
  if coalesce(v_metadata->>'task_attachment_state','') <> 'cleanup_pending' or exists(select 1 from public.file_links where file_source_id=p_file_source_id) then raise exception 'attachment is not cleanup eligible' using errcode='55000'; end if;
  delete from public.file_sources where id=p_file_source_id and user_id=p_owner_id;
  return found;
end; $$;

create or replace function public.claim_task_attachment(p_owner_id uuid,p_file_source_id uuid,p_task_id uuid,p_operation_key uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_metadata jsonb; v_existing uuid;
begin
  select metadata_json into v_metadata from public.file_sources where id=p_file_source_id and user_id=p_owner_id for update;
  if not found then raise exception 'attachment source not found' using errcode='42501'; end if;
  if not exists(select 1 from public.tasks where id=p_task_id and user_id=p_owner_id) then raise exception 'task not found' using errcode='42501'; end if;
  select target_id into v_existing from public.file_links where file_source_id=p_file_source_id and target_type='task' limit 1;
  if found then if v_existing<>p_task_id then raise exception 'attachment already claimed' using errcode='23505'; end if; return; end if;
  if coalesce(v_metadata->>'source_kind','')<>'task-attachment' or coalesce(v_metadata->>'task_attachment_state','') <> 'unclaimed' then raise exception 'attachment source is not claimable' using errcode='22023'; end if;
  insert into public.file_links(file_source_id,target_type,target_id,operation_key) values(p_file_source_id,'task',p_task_id,p_operation_key);
  update public.file_sources set reservation_expires_at=null,metadata_json=metadata_json||jsonb_build_object('cleanup_required',false,'task_attachment_state','claimed','claimed_task_id',p_task_id,'failure_stage',null,'failure_message',null) where id=p_file_source_id;
end; $$;

create or replace function public.create_task_ordered(p_owner_id uuid,p_operation_key uuid,p_title text,p_status text,p_priority text,p_due_at timestamptz,p_description_json jsonb)
returns public.tasks language plpgsql security invoker set search_path = '' as $$
declare v_task public.tasks; v_position numeric;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_owner_id then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text||':'||p_status,1702));
  select * into v_task from public.tasks where user_id=p_owner_id and operation_key=p_operation_key;
  if found then return v_task; end if;
  select coalesce(max(position),0)+1024 into v_position from public.tasks where user_id=p_owner_id and status=p_status;
  insert into public.tasks(user_id,title,status,priority,due_at,description_json,position,operation_key)
  values(p_owner_id,p_title,p_status,p_priority,p_due_at,coalesce(p_description_json,'{}'::jsonb),v_position,p_operation_key) returning * into v_task;
  return v_task;
end; $$;

create or replace function public.move_task_ordered(p_owner_id uuid,p_task_id uuid,p_status text,p_before_task_id uuid,p_after_task_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_before numeric; v_after numeric; v_position numeric; v_first uuid; v_last uuid; v_next uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text||':'||p_status,1702));
  perform 1 from public.tasks where user_id=p_owner_id and status=p_status for update;
  if p_before_task_id is not null then select position into v_before from public.tasks where id=p_before_task_id and user_id=p_owner_id and status=p_status; if not found then raise exception 'task order changed' using errcode='40001'; end if; end if;
  if p_after_task_id is not null then select position into v_after from public.tasks where id=p_after_task_id and user_id=p_owner_id and status=p_status; if not found then raise exception 'task order changed' using errcode='40001'; end if; end if;
  select id into v_first from public.tasks where user_id=p_owner_id and status=p_status and id<>p_task_id order by position,id limit 1;
  select id into v_last from public.tasks where user_id=p_owner_id and status=p_status and id<>p_task_id order by position desc,id desc limit 1;
  if p_before_task_id is null and p_after_task_id is not null and v_first is distinct from p_after_task_id then raise exception 'task order changed' using errcode='40001'; end if;
  if p_after_task_id is null and p_before_task_id is not null and v_last is distinct from p_before_task_id then raise exception 'task order changed' using errcode='40001'; end if;
  if p_before_task_id is not null and p_after_task_id is not null then select id into v_next from public.tasks where user_id=p_owner_id and status=p_status and id<>p_task_id and (position,id)>(v_before,p_before_task_id) order by position,id limit 1; if v_next is distinct from p_after_task_id then raise exception 'task order changed' using errcode='40001'; end if; end if;
  if v_before is not null and v_after is not null and v_after-v_before>0.000001 then v_position=(v_before+v_after)/2;
  elsif v_before is null and v_after is not null then v_position=v_after-1024;
  elsif v_after is null and v_before is not null then v_position=v_before+1024;
  elsif v_before is null and v_after is null then v_position=1024;
  else
    with ranked as (select id,row_number() over(order by position,id)*1024 as next_position from public.tasks where user_id=p_owner_id and status=p_status and id<>p_task_id)
    update public.tasks t set position=r.next_position from ranked r where t.id=r.id;
    select position into v_before from public.tasks where id=p_before_task_id;
    select position into v_after from public.tasks where id=p_after_task_id;
    v_position=(v_before+v_after)/2;
  end if;
  update public.tasks set status=p_status,position=v_position,completed_at=case when p_status='done' then now() else null end,updated_at=now() where id=p_task_id and user_id=p_owner_id;
  if not found then raise exception 'task not found' using errcode='42501'; end if;
end; $$;

create or replace function public.delete_task_cascade(p_owner_id uuid,p_task_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.tasks where id=p_task_id and user_id=p_owner_id for update;
  if not found then return false; end if;
  update public.file_sources fs set reservation_expires_at=null,metadata_json=fs.metadata_json||jsonb_build_object('cleanup_required',false,'task_attachment_state','detached','claimed_task_id',null)
  where fs.user_id=p_owner_id and coalesce(fs.metadata_json->>'source_kind','')='task-attachment' and exists(select 1 from public.file_links fl where fl.file_source_id=fs.id and fl.target_type='task' and fl.target_id=p_task_id);
  delete from public.file_links where target_type='task' and target_id=p_task_id;
  delete from public.workspace_links where resource_type='task' and resource_id=p_task_id;
  delete from public.tasks where id=p_task_id and user_id=p_owner_id;
  return true;
end; $$;

create or replace function public.schedule_task_idempotent(p_owner_id uuid,p_task_id uuid,p_operation_key uuid,p_title text,p_starts_at timestamptz,p_ends_at timestamptz)
returns public.calendar_events language plpgsql security invoker set search_path = '' as $$
declare v_event public.calendar_events; v_calendar uuid;
begin
  if not exists(select 1 from public.tasks where id=p_task_id and user_id=p_owner_id) then raise exception 'task not found' using errcode='42501'; end if;
  select * into v_event from public.calendar_events where user_id=p_owner_id and operation_key=p_operation_key;
  if found then return v_event; end if;
  select id into v_calendar from public.calendars where user_id=p_owner_id order by created_at,id limit 1;
  if v_calendar is null then raise exception 'calendar not found' using errcode='P0001'; end if;
  insert into public.calendar_events(calendar_id,user_id,title,starts_at,ends_at,task_id,operation_key)
  values(v_calendar,p_owner_id,p_title,p_starts_at,p_ends_at,p_task_id,p_operation_key) returning * into v_event;
  return v_event;
end; $$;

revoke all on function public.reserve_task_attachment(uuid,uuid,uuid,text,text,text,bigint,timestamptz) from public, anon;
revoke all on function public.begin_task_attachment_cleanup(uuid,uuid,text,text,text) from public, anon;
revoke all on function public.finalize_task_attachment_cleanup(uuid,uuid,text) from public, anon;
revoke all on function public.claim_task_attachment(uuid,uuid,uuid,uuid) from public, anon;
revoke all on function public.create_task_ordered(uuid,uuid,text,text,text,timestamptz,jsonb) from public, anon;
revoke all on function public.move_task_ordered(uuid,uuid,text,uuid,uuid) from public, anon;
revoke all on function public.delete_task_cascade(uuid,uuid) from public, anon;
revoke all on function public.schedule_task_idempotent(uuid,uuid,uuid,text,timestamptz,timestamptz) from public, anon;
grant execute on function public.reserve_task_attachment(uuid,uuid,uuid,text,text,text,bigint,timestamptz), public.begin_task_attachment_cleanup(uuid,uuid,text,text,text), public.finalize_task_attachment_cleanup(uuid,uuid,text), public.claim_task_attachment(uuid,uuid,uuid,uuid), public.create_task_ordered(uuid,uuid,text,text,text,timestamptz,jsonb), public.move_task_ordered(uuid,uuid,text,uuid,uuid), public.delete_task_cascade(uuid,uuid), public.schedule_task_idempotent(uuid,uuid,uuid,text,timestamptz,timestamptz) to authenticated, service_role;
