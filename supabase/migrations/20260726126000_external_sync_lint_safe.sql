-- Keep external reconciliation atomic without a temporary relation. This makes
-- the function statically checkable by plpgsql_check and avoids temp-schema
-- assumptions in pooled connections.

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
  if (select auth.role()) <> 'service_role' then
    raise exception 'external sync requires service access'
      using errcode = '42501';
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

  with staged as (
    select
      btrim(event.external_event_id) as external_event_id,
      coalesce(nullif(btrim(event.title), ''), 'Untitled event') as title,
      event.starts_at,
      event.ends_at,
      event.all_day,
      nullif(btrim(event.location), '') as location,
      nullif(event.description, '') as description,
      nullif(event.etag, '') as etag,
      event.external_updated_at,
      event.cancelled
    from jsonb_to_recordset(p_events) as event (
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
    where event.external_event_id is not null
      and btrim(event.external_event_id) <> ''
      and event.starts_at is not null
      and event.ends_at > event.starts_at
  )
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
    staged.title,
    staged.starts_at,
    staged.ends_at,
    null,
    null,
    null,
    greatest(
      1,
      ceil(extract(epoch from (staged.ends_at - staged.starts_at)) / 60)
    )::integer,
    null,
    null,
    null,
    null,
    false,
    staged.cancelled,
    case when staged.cancelled then now() else null end,
    null,
    null,
    staged.all_day,
    staged.location,
    case
      when staged.description is null then '{}'::jsonb
      else jsonb_build_object('text', staged.description)
    end,
    null,
    case
      when v_connection.provider = 'google'
      then staged.external_event_id
      else null
    end,
    v_connection.id,
    staged.external_event_id,
    staged.etag,
    staged.external_updated_at,
    v_connection.provider
  from staged
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

  get diagnostics v_count = row_count;

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
        from jsonb_to_recordset(p_events) as event (
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
        where event.external_event_id is not null
          and btrim(event.external_event_id) <> ''
          and event.starts_at is not null
          and event.ends_at > event.starts_at
          and btrim(event.external_event_id) = existing.external_event_id
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
  from public, anon, authenticated;
grant execute on function public.apply_external_calendar_sync(uuid, uuid, jsonb, boolean)
  to service_role;
