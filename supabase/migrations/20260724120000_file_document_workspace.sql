-- Editable Files workspace. Storage objects remain the canonical body for
-- uploaded files; Postgres stores ownership, versioning, notes, comments,
-- history pointers, and indexing lifecycle.

create table if not exists public.file_document_state (
  file_source_id uuid primary key references public.file_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  format text not null check (
    format in ('planevo', 'markdown', 'text', 'pdf', 'docx', 'binary')
  ),
  current_version bigint not null default 0 check (current_version >= 0),
  content_hash text,
  indexed_version bigint check (indexed_version is null or indexed_version >= 0),
  last_checkpoint_at timestamptz,
  encoding_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_document_state_user_updated_idx
  on public.file_document_state (user_id, updated_at desc);

create table if not exists public.file_revisions (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version bigint not null check (version >= 0),
  storage_path text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  content_hash text,
  reason text not null default 'checkpoint' check (
    reason in ('checkpoint', 'close', 'import', 'restore')
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (file_source_id, version)
);

create index if not exists file_revisions_file_created_idx
  on public.file_revisions (file_source_id, created_at desc);
create index if not exists file_revisions_expiry_idx
  on public.file_revisions (expires_at);

create table if not exists public.file_notes (
  file_source_id uuid primary key references public.file_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '' check (octet_length(content) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.file_comment_threads (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  anchor_json jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_comment_threads_file_idx
  on public.file_comment_threads (file_source_id, created_at);

create table if not exists public.file_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.file_comment_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_comments_thread_idx
  on public.file_comments (thread_id, created_at);

create table if not exists public.file_index_jobs (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_version bigint not null check (target_version >= 0),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'ready', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (file_source_id, target_version)
);

create index if not exists file_index_jobs_queue_idx
  on public.file_index_jobs (status, available_at, created_at);

create table if not exists public.file_storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_paths text[] not null default '{}'::text[],
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_storage_cleanup_jobs_queue_idx
  on public.file_storage_cleanup_jobs (status, available_at, created_at);

drop trigger if exists file_document_state_set_updated_at on public.file_document_state;
create trigger file_document_state_set_updated_at
  before update on public.file_document_state
  for each row execute function public.set_updated_at();

drop trigger if exists file_notes_set_updated_at on public.file_notes;
create trigger file_notes_set_updated_at
  before update on public.file_notes
  for each row execute function public.set_updated_at();

drop trigger if exists file_comment_threads_set_updated_at on public.file_comment_threads;
create trigger file_comment_threads_set_updated_at
  before update on public.file_comment_threads
  for each row execute function public.set_updated_at();

drop trigger if exists file_comments_set_updated_at on public.file_comments;
create trigger file_comments_set_updated_at
  before update on public.file_comments
  for each row execute function public.set_updated_at();

drop trigger if exists file_index_jobs_set_updated_at on public.file_index_jobs;
create trigger file_index_jobs_set_updated_at
  before update on public.file_index_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists file_storage_cleanup_jobs_set_updated_at
  on public.file_storage_cleanup_jobs;
create trigger file_storage_cleanup_jobs_set_updated_at
  before update on public.file_storage_cleanup_jobs
  for each row execute function public.set_updated_at();

alter table public.file_document_state enable row level security;
alter table public.file_revisions enable row level security;
alter table public.file_notes enable row level security;
alter table public.file_comment_threads enable row level security;
alter table public.file_comments enable row level security;
alter table public.file_index_jobs enable row level security;
alter table public.file_storage_cleanup_jobs enable row level security;

drop policy if exists file_document_state_owner on public.file_document_state;
create policy file_document_state_owner on public.file_document_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.file_sources source
      where source.id = file_source_id
        and source.user_id = (select auth.uid())
    )
  );

drop policy if exists file_revisions_owner on public.file_revisions;
create policy file_revisions_owner on public.file_revisions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.file_sources source
      where source.id = file_source_id
        and source.user_id = (select auth.uid())
        and public.file_revisions.storage_path
          like source.workspace_id::text || '/%'
    )
  );

drop policy if exists file_notes_owner on public.file_notes;
create policy file_notes_owner on public.file_notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.file_sources source
      where source.id = file_source_id and source.user_id = (select auth.uid())
    )
  );

drop policy if exists file_comment_threads_owner on public.file_comment_threads;
create policy file_comment_threads_owner on public.file_comment_threads
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.file_sources source
      where source.id = file_source_id and source.user_id = (select auth.uid())
    )
  );

drop policy if exists file_comments_owner on public.file_comments;
create policy file_comments_owner on public.file_comments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.file_comment_threads thread
      where thread.id = thread_id and thread.user_id = (select auth.uid())
    )
  );

drop policy if exists file_index_jobs_owner_read on public.file_index_jobs;
drop policy if exists file_index_jobs_owner_manage on public.file_index_jobs;
create policy file_index_jobs_owner_manage on public.file_index_jobs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.file_sources source
      where source.id = file_source_id and source.user_id = (select auth.uid())
    )
  );

drop policy if exists file_storage_cleanup_jobs_owner
  on public.file_storage_cleanup_jobs;
drop policy if exists file_storage_cleanup_jobs_owner_read
  on public.file_storage_cleanup_jobs;
drop policy if exists file_storage_cleanup_jobs_owner_insert
  on public.file_storage_cleanup_jobs;
create policy file_storage_cleanup_jobs_owner_read
  on public.file_storage_cleanup_jobs
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy file_storage_cleanup_jobs_owner_insert
  on public.file_storage_cleanup_jobs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1
      from unnest(storage_paths) as unsafe(path)
      where not (
        unsafe.path like 'page-assets:' || (select auth.uid())::text || '/%'
        or exists (
          select 1
          from public.workspaces workspace
          where workspace.owner_id = (select auth.uid())
            and unsafe.path like workspace.id::text || '/%'
        )
      )
    )
    and not exists (
      select 1
      from unnest(storage_paths) as candidate(path)
      where not exists (
        select 1
        from public.file_sources source
        where source.user_id = (select auth.uid())
          and source.storage_path = candidate.path
      )
      and not exists (
        select 1
        from public.file_revisions revision
        where revision.user_id = (select auth.uid())
          and revision.storage_path = candidate.path
      )
    )
  );

grant select, insert, update, delete on public.file_document_state to authenticated;
grant select, insert, update, delete on public.file_revisions to authenticated;
grant select, insert, update, delete on public.file_notes to authenticated;
grant select, insert, update, delete on public.file_comment_threads to authenticated;
grant select, insert, update, delete on public.file_comments to authenticated;
grant select, insert, update, delete on public.file_index_jobs to authenticated;
grant select, insert on public.file_storage_cleanup_jobs to authenticated;
grant select, insert, update, delete
  on public.file_storage_cleanup_jobs to service_role;

-- Atomic compare-and-swap for Planevo-native documents.
create or replace function public.save_file_page_document(
  p_owner_id uuid,
  p_file_source_id uuid,
  p_base_version bigint,
  p_content_json jsonb,
  p_content_hash text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page_id uuid;
  v_current_version bigint;
  v_next_version bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select source.page_id
  into v_page_id
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
  for update;

  if v_page_id is null then
    raise exception 'file is not a Planevo document' using errcode = '22023';
  end if;

  insert into public.file_document_state (
    file_source_id, user_id, format, current_version
  ) values (
    p_file_source_id, p_owner_id, 'planevo', 0
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

  update public.pages
  set content_json = p_content_json
  where id = v_page_id;

  update public.file_document_state
  set current_version = v_next_version,
      content_hash = p_content_hash
  where file_source_id = p_file_source_id;

  update public.file_sources
  set updated_at = now()
  where id = p_file_source_id;

  return jsonb_build_object(
    'version', v_next_version,
    'contentHash', p_content_hash
  );
end;
$$;

-- Atomic compare-and-swap that makes an already-uploaded staging object the
-- canonical body for a Markdown/TXT file.
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
  v_current_version bigint;
  v_next_version bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_format not in ('markdown', 'text') then
    raise exception 'unsupported editable text format' using errcode = '22023';
  end if;

  select source.storage_path
  into v_previous_storage_path
  from public.file_sources source
  where source.id = p_file_source_id
    and source.user_id = p_owner_id
    and source.page_id is null
  for update;

  if v_previous_storage_path is null then
    raise exception 'file not found' using errcode = 'P0002';
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

revoke all on function public.save_file_page_document(uuid, uuid, bigint, jsonb, text)
  from public, anon;
grant execute on function public.save_file_page_document(uuid, uuid, bigint, jsonb, text)
  to authenticated, service_role;

revoke all on function public.finalize_file_text_document(
  uuid, uuid, bigint, text, bigint, text, text, jsonb
) from public, anon;
grant execute on function public.finalize_file_text_document(
  uuid, uuid, bigint, text, bigint, text, text, jsonb
) to authenticated, service_role;

-- Delete database metadata and its backing Planevo page atomically, while
-- retaining a durable list of storage objects for asynchronous cleanup.
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
  v_storage_paths text[];
  v_cleanup_job_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select source.workspace_id, source.page_id, source.storage_path
  into v_workspace_id, v_page_id, v_storage_path
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
    and revision.user_id = p_owner_id;

  if v_storage_path is not null and v_storage_path not like 'page:%' then
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

-- Rebuild search chunks in one transaction so readers never observe a
-- partially replaced document.
create or replace function public.replace_file_source_chunks(
  p_file_source_id uuid,
  p_target_version bigint,
  p_chunks jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_version bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_chunks) is distinct from 'array' then
    raise exception 'chunks must be an array' using errcode = '22023';
  end if;

  select state.current_version
  into v_current_version
  from public.file_document_state state
  where state.file_source_id = p_file_source_id
  for update;

  if v_current_version is distinct from p_target_version then
    raise exception 'document version conflict' using errcode = 'P0001';
  end if;

  delete from public.source_chunks
  where file_source_id = p_file_source_id;

  insert into public.source_chunks (
    file_source_id, position, content, token_count, metadata_json
  )
  select
    p_file_source_id,
    chunk.position,
    chunk.content,
    chunk.token_count,
    coalesce(chunk.metadata_json, '{}'::jsonb)
  from jsonb_to_recordset(p_chunks) as chunk(
    position integer,
    content text,
    token_count integer,
    metadata_json jsonb
  );

  update public.file_document_state
  set indexed_version = p_target_version
  where file_source_id = p_file_source_id;
end;
$$;

revoke all on function public.replace_file_source_chunks(uuid, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_file_source_chunks(uuid, bigint, jsonb)
  to service_role;

-- Durable worker claim: concurrent Cron invocations cannot process the same
-- indexing job because rows are locked with skip locked.
create or replace function public.claim_file_index_jobs(
  p_limit integer default 10
) returns setof public.file_index_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with claimed as (
    select job.id
    from public.file_index_jobs job
    where (
        (
          job.status in ('queued', 'failed')
          and job.available_at <= now()
        )
        or (
          job.status = 'processing'
          and job.updated_at < now() - interval '10 minutes'
        )
      )
      and job.attempts < 5
    order by job.available_at, job.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 50))
  )
  update public.file_index_jobs job
  set status = 'processing',
      attempts = job.attempts + 1,
      last_error = null
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$$;

revoke all on function public.claim_file_index_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_file_index_jobs(integer)
  to service_role;

create or replace function public.claim_file_storage_cleanup_jobs(
  p_limit integer default 10
) returns setof public.file_storage_cleanup_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with claimed as (
    select cleanup.id
    from public.file_storage_cleanup_jobs cleanup
    where (
        (
          cleanup.status in ('queued', 'failed')
          and cleanup.available_at <= now()
        )
        or (
          cleanup.status = 'processing'
          and cleanup.updated_at < now() - interval '10 minutes'
        )
      )
      and cleanup.attempts < 10
    order by cleanup.available_at, cleanup.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 50))
  )
  update public.file_storage_cleanup_jobs cleanup
  set status = 'processing',
      attempts = cleanup.attempts + 1,
      last_error = null
  from claimed
  where cleanup.id = claimed.id
  returning cleanup.*;
end;
$$;

revoke all on function public.claim_file_storage_cleanup_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_file_storage_cleanup_jobs(integer)
  to service_role;
