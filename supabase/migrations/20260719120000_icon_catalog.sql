-- Font Awesome icon catalog (searchable, cached metadata from npm packages).
-- Seeded via scripts/seed-icon-catalog.mjs — not embedded in migration.

create table public.icon_catalog (
  id text primary key,
  library text not null check (library in ('solid', 'regular')),
  icon_name text not null,
  label text not null,
  search_text text not null,
  svg_path text not null,
  width integer not null,
  height integer not null,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored
);

create index icon_catalog_search_idx on public.icon_catalog using gin (search_vector);
create index icon_catalog_label_idx on public.icon_catalog (label);

-- Query result cache — prevents repeated heavy search under load.
create table public.icon_search_cache (
  query_hash text primary key,
  query_text text not null,
  results_json jsonb not null,
  hit_count integer not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index icon_search_cache_expires_idx on public.icon_search_cache (expires_at);

alter table public.icon_catalog enable row level security;
alter table public.icon_search_cache enable row level security;

create policy icon_catalog_select_authenticated
  on public.icon_catalog
  for select
  to authenticated
  using (true);

create policy icon_search_cache_select_authenticated
  on public.icon_search_cache
  for select
  to authenticated
  using (true);

create policy icon_search_cache_insert_authenticated
  on public.icon_search_cache
  for insert
  to authenticated
  with check (true);

create policy icon_search_cache_update_authenticated
  on public.icon_search_cache
  for update
  to authenticated
  using (true)
  with check (true);
