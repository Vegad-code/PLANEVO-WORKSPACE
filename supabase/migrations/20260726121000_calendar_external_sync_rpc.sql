-- Atomic owner-scoped application of one external calendar snapshot/delta.
-- The network worker parses provider payloads; PostgreSQL owns reconciliation
-- so a failed write cannot leave half a feed visible.

create or replace function public.apply_external_calendar_sync(
  p_owner_id uuid,
  p_connection_id uuid,
  p_events jsonb,
  p_replace boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection public.calendar_connections;
  v_count integer;
begin
  if (select auth.role()) <> 'service_role'
     and p_owner_id is distinct from (select auth.uid()) then
    raise exception 'calendar connection not found' using errcode = '42501';
  end if;

  if jsonb_typeof(p_events) is distinct from 'array'
     or jsonb_array_length(p_events) > 5000 then
    raise exception 'invalid external event payload' using errcode = '22023';
  end if;

  select *
  into v_connection
  from public.calendar_connections
  where id = p_connection_id
    and user_id = p_owner_id
    and is_enabled
  for update;

  if not found then
    raise exception 'calendar connection not found' using errcode = '42501';
  end if;

  create temporary table if not exists pg_temp.external_calendar_stage (
    external_event_id text primary key,
    title text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    all_day boolean not null,
    location text,
    description text,
    etag text,
    external_updated_at timestamptz,
    cancelled boolean not null
  ) on commit drop;
  truncate pg_temp.external_calendar_stage;

  insert into pg_temp.external_calendar_stage (
    external_event_id,
    title,
    starts_at,
    ends_at,
    all_day,
    location,
    description,
    etag,
    external_updated_at,
    cancelled
  )
  select
    btrim(e.external_event_id),
    coalesce(nullif(btrim(e.title), ''), 'Untitled event'),
    e.starts_at,
    e.ends_at,
    e.all_day,
    nullif(btrim(e.location), ''),
    nullif(e.description, ''),
    nullif(e.etag, ''),
    e.external_updated_at,
    e.cancelled
  from jsonb_to_recordset(p_events) as e (
    external_event_id text,
    title text,
    starts_at timestamptz,
    ends_at timestamptz,
    all_day boolean,
    location text,
    description text,
    etag text,
    external_updated_at timestamptz,
    cancelled boolean
  )
  where e.external_event_id is not null
    and btrim(e.external_event_id) <> ''
    and e.starts_at is not null
    and e.ends_at > e.starts_at;

  get diagnostics v_count = row_count;

  insert into public.calendar_events (
    calendar_id,
    user_id,
    title,
    starts_at,
    ends_at,
    starts_at_local,
    ends_at_local,
    timezone,
    duration_minutes,
    rrule,
    recurrence_end,
    parent_event_id,
    recurrence_id,
    is_exception,
    is_cancelled,
    deleted_at,
    color,
    conference_url,
    all_day,
    location,
    description_json,
    task_id,
    google_event_id,
    external_connection_id,
    external_event_id,
    external_etag,
    external_updated_at,
    source
  )
  select
    v_connection.calendar_id,
    p_owner_id,
    s.title,
    s.starts_at,
    s.ends_at,
    null,
    null,
    null,
    greatest(1, ceil(extract(epoch from (s.ends_at - s.starts_at)) / 60))::integer,
    null,
    null,
    null,
    null,
    false,
    s.cancelled,
    case when s.cancelled then now() else null end,
    null,
    null,
    s.all_day,
    s.location,
    case
      when s.description is null then '{}'::jsonb
      else jsonb_build_object('text', s.description)
    end,
    null,
    case when v_connection.provider = 'google' then s.external_event_id else null end,
    v_connection.id,
    s.external_event_id,
    s.etag,
    s.external_updated_at,
    v_connection.provider
  from pg_temp.external_calendar_stage s
  on conflict (calendar_id, source, external_event_id)
  do update set
    title = excluded.title,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    duration_minutes = excluded.duration_minutes,
    is_cancelled = excluded.is_cancelled,
    deleted_at = excluded.deleted_at,
    all_day = excluded.all_day,
    location = excluded.location,
    description_json = excluded.description_json,
    google_event_id = excluded.google_event_id,
    external_connection_id = excluded.external_connection_id,
    external_etag = excluded.external_etag,
    external_updated_at = excluded.external_updated_at,
    updated_at = now();

  if p_replace then
    update public.calendar_events existing
    set
      is_cancelled = true,
      deleted_at = coalesce(existing.deleted_at, now()),
      updated_at = now()
    where existing.user_id = p_owner_id
      and existing.external_connection_id = v_connection.id
      and not exists (
        select 1
        from pg_temp.external_calendar_stage staged
        where staged.external_event_id = existing.external_event_id
      );
  end if;

  update public.calendar_connections
  set
    last_synced_at = now(),
    last_sync_error = null,
    updated_at = now()
  where id = v_connection.id
    and user_id = p_owner_id;

  return v_count;
end;
$$;

revoke all on function public.apply_external_calendar_sync(uuid, uuid, jsonb, boolean)
  from public, anon;
grant execute on function public.apply_external_calendar_sync(uuid, uuid, jsonb, boolean)
  to authenticated, service_role;
