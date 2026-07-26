-- Atomically create a Planevo calendar and its read-only ICS source.

create or replace function public.subscribe_ics_calendar(
  p_owner_id uuid,
  p_name text,
  p_color text,
  p_feed_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_calendar public.calendars;
  v_connection public.calendar_connections;
begin
  if (select auth.role()) <> 'service_role'
     and p_owner_id is distinct from (select auth.uid()) then
    raise exception 'calendar owner mismatch' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null
     or length(btrim(p_name)) > 120
     or p_color not in ('slate', 'marigold', 'meadow', 'brick', 'ocean')
     or p_feed_url !~* '^https://[^[:space:]]+$' then
    raise exception 'invalid calendar subscription' using errcode = '22023';
  end if;

  insert into public.calendars (
    user_id,
    name,
    color,
    is_visible,
    is_default,
    position
  )
  values (
    p_owner_id,
    btrim(p_name),
    p_color,
    true,
    not exists (
      select 1
      from public.calendars existing
      where existing.user_id = p_owner_id
        and existing.is_default
    ),
    coalesce((
      select max(existing.position) + 1
      from public.calendars existing
      where existing.user_id = p_owner_id
    ), 0)
  )
  returning * into v_calendar;

  insert into public.calendar_connections (
    user_id,
    calendar_id,
    provider,
    feed_url
  )
  values (
    p_owner_id,
    v_calendar.id,
    'ics',
    p_feed_url
  )
  returning * into v_connection;

  return jsonb_build_object(
    'calendar_id', v_calendar.id,
    'connection_id', v_connection.id
  );
end;
$$;

revoke all on function public.subscribe_ics_calendar(uuid, text, text, text)
  from public, anon;
grant execute on function public.subscribe_ics_calendar(uuid, text, text, text)
  to authenticated, service_role;
