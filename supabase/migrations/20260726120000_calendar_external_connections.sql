-- External calendar subscriptions and Google read sync.
--
-- Secrets live outside calendars/calendar_events so ordinary calendar reads
-- can never return feed URLs or encrypted OAuth tokens. Every table remains
-- owner-scoped and every function (none are added here) stays invoker-scoped.

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_account_id text not null,
  display_name text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  account_id uuid references public.calendar_accounts (id) on delete cascade,
  provider text not null check (provider in ('ics', 'google')),
  provider_calendar_id text,
  feed_url text,
  feed_etag text,
  feed_last_modified text,
  sync_token text,
  watch_channel_id text,
  watch_resource_id text,
  watch_token text,
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  is_enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id),
  check (
    (
      provider = 'ics'
      and account_id is null
      and feed_url is not null
      and provider_calendar_id is null
    )
    or
    (
      provider = 'google'
      and account_id is not null
      and feed_url is null
      and provider_calendar_id is not null
    )
  )
);

create unique index if not exists calendar_connections_google_source_uidx
  on public.calendar_connections (account_id, provider_calendar_id)
  where provider = 'google';

create index if not exists calendar_connections_sync_due_idx
  on public.calendar_connections (provider, is_enabled, last_synced_at);

create index if not exists calendar_connections_watch_due_idx
  on public.calendar_connections (provider, is_enabled, watch_expires_at)
  where provider = 'google';

alter table public.calendar_events
  add column if not exists external_connection_id uuid
    references public.calendar_connections (id) on delete set null,
  add column if not exists external_event_id text,
  add column if not exists external_etag text,
  add column if not exists external_updated_at timestamptz;

update public.calendar_events
set external_event_id = google_event_id
where source = 'google'
  and google_event_id is not null
  and external_event_id is null;

alter table public.calendar_events
  drop constraint if exists calendar_events_source_check;

alter table public.calendar_events
  add constraint calendar_events_source_check
  check (source in ('planevo', 'ics', 'google'));

alter table public.calendar_events
  drop constraint if exists calendar_events_external_identity_unique;

alter table public.calendar_events
  add constraint calendar_events_external_identity_unique
  unique (calendar_id, source, external_event_id);

create index if not exists calendar_events_external_connection_idx
  on public.calendar_events (external_connection_id, deleted_at);

alter table public.calendar_accounts enable row level security;
alter table public.calendar_connections enable row level security;

drop policy if exists calendar_accounts_owner on public.calendar_accounts;
create policy calendar_accounts_owner
  on public.calendar_accounts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists calendar_connections_owner on public.calendar_connections;
create policy calendar_connections_owner
  on public.calendar_connections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.calendars c
      where c.id = calendar_id
        and c.user_id = (select auth.uid())
    )
    and (
      account_id is null
      or exists (
        select 1
        from public.calendar_accounts a
        where a.id = account_id
          and a.user_id = (select auth.uid())
      )
    )
  );

grant select, insert, update, delete
  on public.calendar_accounts, public.calendar_connections
  to authenticated;
