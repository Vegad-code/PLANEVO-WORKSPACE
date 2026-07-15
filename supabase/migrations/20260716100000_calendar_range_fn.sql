-- Workspace-wide calendar feed with the date-range filter pushed into SQL.
-- Replaces the load-every-record-then-filter-in-JS calendar loader: one call,
-- bounded by the visible month grid.
--
-- ponytail: this scans record_values per date property within the workspace;
-- add an expression index on ((value_json #>> '{}')::timestamptz) for date
-- properties if EXPLAIN hurts past ~50k values.

create or replace function public.get_workspace_calendar_records(
  p_workspace_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  record_id uuid,
  property_id uuid,
  title text,
  occurs_at timestamptz,
  database_id uuid,
  database_name text,
  page_id uuid
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    r.id,
    dp.id,
    coalesce(nullif(btrim(title_value.value_json #>> '{}'), ''), 'Untitled'),
    (rv.value_json #>> '{}')::timestamptz,
    d.id,
    d.name,
    d.page_id
  from public.databases d
  join public.database_properties dp
    on dp.database_id = d.id and dp.type = 'date'
  join public.record_values rv on rv.property_id = dp.id
  join public.records r on r.id = rv.record_id
  left join lateral (
    select rv2.value_json
    from public.record_values rv2
    join public.database_properties tp
      on tp.id = rv2.property_id and tp.is_primary
    where rv2.record_id = r.id
    limit 1
  ) title_value on true
  where d.workspace_id = p_workspace_id
    and jsonb_typeof(rv.value_json) = 'string'
    and (rv.value_json #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
    and (rv.value_json #>> '{}')::timestamptz >= p_start
    and (rv.value_json #>> '{}')::timestamptz < p_end
  order by (rv.value_json #>> '{}')::timestamptz asc
  limit 500
$$;

revoke all on function public.get_workspace_calendar_records(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_workspace_calendar_records(uuid, timestamptz, timestamptz) to authenticated, service_role;
