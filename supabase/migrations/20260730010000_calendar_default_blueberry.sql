-- Default Main calendar color: graphite (gray) → blueberry (founder screenshot blue).
-- New users get blueberry from create_user_products; existing Main calendars still
-- on the stock graphite seed move to blueberry so creates match the product default.
-- Non-main calendars intentionally left on graphite if the user chose that swatch.

update public.calendars
set color = 'blueberry'
where is_main
  and color = 'graphite';

create or replace function public.create_user_products(
  p_user_id uuid,
  p_seed jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  main_calendar_id uuid;
  task_el jsonb;
  new_task_id uuid;
  task_ids uuid[] := array[]::uuid[];
  pos numeric := 0;
  products_created boolean := false;
begin
  if (select auth.role()) <> 'service_role'
    and (select auth.uid()) is distinct from p_user_id
  then
    raise exception 'user id does not match the mutation actor'
      using errcode = '42501';
  end if;

  select calendar.id
  into main_calendar_id
  from public.calendars calendar
  where calendar.user_id = p_user_id and calendar.is_main
  limit 1;

  if main_calendar_id is null then
    insert into public.calendars (
      user_id,
      name,
      color,
      is_main,
      is_included_in_main,
      is_default,
      position
    )
    values (
      p_user_id,
      'Main',
      'blueberry',
      true,
      true,
      not exists (
        select 1 from public.calendars calendar
        where calendar.user_id = p_user_id and calendar.is_default
      ),
      -1
    )
    returning id into main_calendar_id;
    products_created := true;
  end if;

  if not exists (
    select 1 from public.tasks task where task.user_id = p_user_id
  ) then
    for task_el in
      select * from jsonb_array_elements(
        coalesce(p_seed -> 'starterTasks', '[]'::jsonb)
      )
    loop
      insert into public.tasks (user_id, title, status, position)
      values (
        p_user_id,
        coalesce(nullif(btrim(task_el ->> 'title'), ''), 'Untitled'),
        coalesce(
          nullif(btrim(task_el ->> 'status'), ''),
          'not_started'
        ),
        pos
      )
      returning id into new_task_id;
      task_ids := array_append(task_ids, new_task_id);
      pos := pos + 1;
    end loop;
    products_created := true;
  else
    select coalesce(
      array_agg(task.id order by task.position, task.id),
      array[]::uuid[]
    )
    into task_ids
    from public.tasks task
    where task.user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'calendar_id', main_calendar_id,
    'task_ids', to_jsonb(task_ids),
    'created', products_created
  );
end;
$$;
