-- Optional manual seed (SQL editor). Prefer: npm run db:seed from apps/web.
--
-- Creates the local dev owner, workspace, and sidebar pages used by the app shell.
-- Safe to re-run: skips rows that already exist.

create extension if not exists pgcrypto;

do $$
declare
  dev_user_id uuid := 'b0000000-0000-4000-8000-000000000001';
  workspace_id uuid;
  physics_id uuid;
  apps_id uuid;
begin
  if not exists (select 1 from auth.users where id = dev_user_id) then
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      dev_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'dev@planevo.local',
      crypt('planevo-dev-local-only', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Anthony"}'::jsonb,
      now(),
      now()
    );
  end if;

  select id into workspace_id
  from public.workspaces
  where owner_id = dev_user_id
  order by created_at
  limit 1;

  if workspace_id is null then
    insert into public.workspaces (owner_id, name)
    values (dev_user_id, 'Anthony''s workspace')
    returning id into workspace_id;
  end if;

  if not exists (select 1 from public.pages where workspace_id = workspace_id) then
    insert into public.pages (workspace_id, title, position)
    values (workspace_id, 'Physics 2400', 0)
    returning id into physics_id;

    insert into public.pages (workspace_id, parent_page_id, title, position)
    values (workspace_id, physics_id, 'Lab notes', 0);

    insert into public.pages (workspace_id, title, position)
    values (workspace_id, 'Apps tracker', 1)
    returning id into apps_id;

    insert into public.pages (workspace_id, parent_page_id, title, position)
    values (workspace_id, apps_id, 'Launch checklist', 0);

    insert into public.pages (workspace_id, title, position)
    values (workspace_id, 'Reading list', 2);
  end if;
end $$;
