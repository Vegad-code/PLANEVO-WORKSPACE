-- File folders: a real folder tree for the Files → Knowledge Base revamp.
-- Additive; apply via the hosted SQL Editor (repo convention — never local
-- Docker). Owner-only RLS mirrors file_sources. Folder membership is tracked by
-- a nullable file_sources.folder_id FK (on delete set null unfiles, not destroys).

create table if not exists public.file_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable, unused for now: kept for future per-workspace knowledge bases.
  workspace_id uuid references public.workspaces (id) on delete set null,
  parent_id uuid references public.file_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_folders_user_parent_idx
  on public.file_folders (user_id, parent_id, position);

drop trigger if exists file_folders_set_updated_at on public.file_folders;
create trigger file_folders_set_updated_at
  before update on public.file_folders
  for each row execute function public.set_updated_at();

alter table public.file_folders enable row level security;

drop policy if exists "owners manage file folders" on public.file_folders;
create policy "owners manage file folders"
  on public.file_folders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.file_folders to authenticated;

-- Membership column: which folder a file lives in (null = unfiled). on delete
-- set null so removing a folder unfiles its files rather than deleting them.
alter table public.file_sources
  add column if not exists folder_id uuid references public.file_folders (id) on delete set null;

create index if not exists file_sources_user_folder_idx
  on public.file_sources (user_id, folder_id);
