-- Planevo application foundations.
--
-- All reads remain side-effect free. The functions at the bottom are invoked only
-- by explicit user actions and each function executes as one Postgres transaction.

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  minimal boolean not null default false,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recent_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  target_type text not null check (target_type in ('page', 'database', 'record', 'file', 'conversation')),
  target_id uuid not null,
  last_opened_at timestamptz not null default now(),
  unique (user_id, workspace_id, target_type, target_id)
);

create index recent_items_user_opened_idx
  on public.recent_items (user_id, last_opened_at desc);

create table public.onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  organizing text check (organizing is null or organizing in ('work', 'personal', 'school', 'other')),
  current_step integer not null default 0 check (current_step >= 0),
  completed_steps_json jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.file_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  ingestion_status text not null default 'pending'
    check (ingestion_status in ('pending', 'processing', 'ready', 'failed')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index file_sources_workspace_created_idx
  on public.file_sources (workspace_id, created_at desc);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('gmail', 'google_calendar', 'google_drive', 'canvas')),
  external_account_id text not null default '',
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connecting', 'connected', 'error')),
  config_json jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_account_id)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_workspace_updated_idx
  on public.ai_conversations (workspace_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content_json jsonb not null default '[]'::jsonb,
  model_used text,
  usage_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at);

create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  position integer not null check (position >= 0),
  content text not null,
  token_count integer check (token_count is null or token_count >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (file_source_id, position)
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create trigger onboarding_progress_set_updated_at
  before update on public.onboarding_progress
  for each row execute function public.set_updated_at();

create trigger file_sources_set_updated_at
  before update on public.file_sources
  for each row execute function public.set_updated_at();

create trigger integration_connections_set_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.recent_items enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.file_sources enable row level security;
alter table public.integration_connections enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.source_chunks enable row level security;

create policy "users manage own preferences"
  on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users manage own recent items"
  on public.recent_items for all to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_owner(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_workspace_owner(workspace_id));

create policy "users manage own onboarding progress"
  on public.onboarding_progress for all to authenticated
  using (
    user_id = (select auth.uid())
    and (workspace_id is null or public.is_workspace_owner(workspace_id))
  )
  with check (
    user_id = (select auth.uid())
    and (workspace_id is null or public.is_workspace_owner(workspace_id))
  );

create policy "workspace owners manage file sources"
  on public.file_sources for all to authenticated
  using (created_by = (select auth.uid()) and public.is_workspace_owner(workspace_id))
  with check (created_by = (select auth.uid()) and public.is_workspace_owner(workspace_id));

create policy "users manage own integration connections"
  on public.integration_connections for all to authenticated
  using (
    user_id = (select auth.uid())
    and (workspace_id is null or public.is_workspace_owner(workspace_id))
  )
  with check (
    user_id = (select auth.uid())
    and (workspace_id is null or public.is_workspace_owner(workspace_id))
  );

create policy "workspace owners manage ai conversations"
  on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_owner(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_workspace_owner(workspace_id));

create policy "workspace owners manage ai messages"
  on public.ai_messages for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
        and public.is_workspace_owner(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
        and public.is_workspace_owner(c.workspace_id)
    )
  );

create policy "workspace owners manage source chunks"
  on public.source_chunks for all to authenticated
  using (
    exists (
      select 1 from public.file_sources f
      where f.id = file_source_id
        and f.created_by = (select auth.uid())
        and public.is_workspace_owner(f.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.file_sources f
      where f.id = file_source_id
        and f.created_by = (select auth.uid())
        and public.is_workspace_owner(f.workspace_id)
    )
  );

grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.recent_items to authenticated;
grant select, insert, update, delete on public.onboarding_progress to authenticated;
grant select, insert, update, delete on public.file_sources to authenticated;
grant select, insert, update, delete on public.integration_connections to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, insert, update, delete on public.source_chunks to authenticated;

-- Files are private. The first path segment is always the owning workspace UUID.
insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do update set public = false;

create policy "workspace owners read files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'workspace-files'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "workspace owners upload files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'workspace-files'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "workspace owners update files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'workspace-files'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'workspace-files'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

create policy "workspace owners delete files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'workspace-files'
    and public.is_workspace_owner(((storage.foldername(name))[1])::uuid)
  );

-- Explicit mutation RPCs. They are deliberately SECURITY INVOKER. A normal user may
-- mutate only their own rows; the server-only service role is accepted for pre-auth
-- local development after it has resolved the deterministic dev alias to an auth user.

create or replace function public.create_planevo_workspace(
  p_owner_id uuid,
  p_name text,
  p_icon text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_workspace public.workspaces;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'workspace name is required' using errcode = '22023';
  end if;

  insert into public.workspaces (owner_id, name, icon)
  values (p_owner_id, btrim(p_name), p_icon)
  returning * into created_workspace;

  return jsonb_build_object('workspace_id', created_workspace.id);
end;
$$;

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

  insert into public.database_properties (database_id, name, type, position, is_primary)
  values (created_database_id, 'Task', 'text', 0, true)
  returning id into title_property_id;
  insert into public.database_properties (database_id, name, type, position)
  values
    (created_database_id, 'Description', 'text', 1),
    (created_database_id, 'Status', 'select', 2),
    (created_database_id, 'Priority', 'select', 3),
    (created_database_id, 'Due date', 'date', 4),
    (created_database_id, 'Estimate', 'number', 5),
    (created_database_id, 'Tags', 'multi-select', 6),
    (created_database_id, 'Attachments', 'text', 7);

  select id into status_property_id from public.database_properties
    where database_id = created_database_id and name = 'Status';
  select id into due_property_id from public.database_properties
    where database_id = created_database_id and name = 'Due date';

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

  insert into public.database_properties (database_id, name, type, position, is_primary)
  values (created_database_id, 'Event', 'text', 0, true);
  insert into public.database_properties (database_id, name, type, position)
  values (created_database_id, 'Date', 'date', 1)
  returning id into date_property_id;
  insert into public.database_properties (database_id, name, type, position)
  values
    (created_database_id, 'Description', 'text', 2),
    (created_database_id, 'Status', 'select', 3);

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

create or replace function public.create_document_page(
  p_owner_id uuid,
  p_workspace_id uuid,
  p_title text default 'Untitled'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_page_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'workspace owner does not match the mutation actor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p_owner_id
  ) then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  insert into public.pages (workspace_id, title)
  values (p_workspace_id, coalesce(nullif(btrim(p_title), ''), 'Untitled'))
  returning id into created_page_id;

  return jsonb_build_object('workspace_id', p_workspace_id, 'page_id', created_page_id);
end;
$$;

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

  insert into public.records (database_id, position, created_by)
  values (
    target_database_id,
    (select count(*)::integer from public.records where database_id = target_database_id),
    p_owner_id
  )
  returning id into created_record_id;

  for property_row in
    select id, name from public.database_properties where database_id = target_database_id
  loop
    value_payload := case property_row.name
      when 'Task' then to_jsonb(btrim(p_title))
      when 'Description' then to_jsonb(p_description)
      when 'Status' then to_jsonb(coalesce(nullif(btrim(p_status), ''), 'To do'))
      when 'Priority' then to_jsonb(p_priority)
      when 'Due date' then to_jsonb(p_due_date)
      when 'Estimate' then to_jsonb(p_estimate_minutes)
      when 'Tags' then p_tags
      when 'Attachments' then p_attachments
      else null
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

revoke all on function public.create_planevo_workspace(uuid, text, text) from public, anon;
revoke all on function public.create_task_database_with_views(uuid, uuid, text) from public, anon;
revoke all on function public.create_calendar_database_with_views(uuid, uuid, text) from public, anon;
revoke all on function public.create_document_page(uuid, uuid, text) from public, anon;
revoke all on function public.create_task_with_required_foundation(uuid, uuid, text, text, text, text, timestamptz, integer, jsonb, jsonb) from public, anon;

grant execute on function public.create_planevo_workspace(uuid, text, text) to authenticated, service_role;
grant execute on function public.create_task_database_with_views(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.create_calendar_database_with_views(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.create_document_page(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.create_task_with_required_foundation(uuid, uuid, text, text, text, text, timestamptz, integer, jsonb, jsonb) to authenticated, service_role;
