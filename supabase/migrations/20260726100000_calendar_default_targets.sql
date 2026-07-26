-- Atomically switch the user's default saved view or source calendar.
--
-- The partial unique indexes guarantee at most one default. These functions
-- additionally serialize writes per user, so two concurrent switches cannot
-- leave the user with no default after one request clears the other's target.

create or replace function public.set_default_calendar_view(
  p_owner_id uuid,
  p_view_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'calendar view owner mismatch' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('calendar-view:' || p_owner_id::text, 0)
  );

  if not exists (
    select 1
    from public.calendar_views
    where id = p_view_id
      and user_id = p_owner_id
  ) then
    raise exception 'calendar view not found' using errcode = 'P0002';
  end if;

  update public.calendar_views
  set is_default = false,
      updated_at = now()
  where user_id = p_owner_id
    and is_default
    and id <> p_view_id;

  update public.calendar_views
  set is_default = true,
      updated_at = now()
  where id = p_view_id
    and user_id = p_owner_id;
end;
$$;

create or replace function public.set_default_calendar(
  p_owner_id uuid,
  p_calendar_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_owner_id
  then
    raise exception 'calendar owner mismatch' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('calendar-source:' || p_owner_id::text, 0)
  );

  if not exists (
    select 1
    from public.calendars
    where id = p_calendar_id
      and user_id = p_owner_id
  ) then
    raise exception 'calendar not found' using errcode = 'P0002';
  end if;

  update public.calendars
  set is_default = false
  where user_id = p_owner_id
    and is_default
    and id <> p_calendar_id;

  update public.calendars
  set is_default = true
  where id = p_calendar_id
    and user_id = p_owner_id;
end;
$$;

revoke all on function public.set_default_calendar_view(uuid, uuid) from public;
revoke all on function public.set_default_calendar_view(uuid, uuid) from anon;
grant execute on function public.set_default_calendar_view(uuid, uuid)
to authenticated, service_role;

revoke all on function public.set_default_calendar(uuid, uuid) from public;
revoke all on function public.set_default_calendar(uuid, uuid) from anon;
grant execute on function public.set_default_calendar(uuid, uuid)
to authenticated, service_role;
