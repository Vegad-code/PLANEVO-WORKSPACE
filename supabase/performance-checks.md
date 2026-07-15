# Query-plan checks

Run after `npm run db:push` (migrations 3–5 applied) and `npm run db:seed`
(creates the "Perf sandbox (seed)" workspace with ~10k records). Execute in the
Supabase SQL editor or psql, substituting the ids the seed script prints.

Acceptance: every plan below uses the named index — no sequential scan of
`records` or `record_values` on these paths.

## 1. Pivoted record page (`get_database_records`)

```sql
explain analyze
select * from public.get_database_records('<database_id>', 200, 0);
```

Expect: `records_database_idx (database_id, position)` index scan for the page,
`record_values_record_id_property_id_key` lookups for values. Cost must not
grow with total records beyond the requested page.

## 2. Workspace calendar month (`get_workspace_calendar_records`)

```sql
explain analyze
select * from public.get_workspace_calendar_records(
  '<workspace_id>', now() - interval '21 days', now() + interval '21 days');
```

Expect: `databases_workspace_idx` + `record_values_property_idx` driving the
join. If `record_values` shows a wide scan past ~50k values, add the expression
index noted in the migration header:

```sql
create index record_values_date_expr_idx
  on public.record_values (((value_json #>> '{}')::timestamptz))
  where jsonb_typeof(value_json) = 'string';
-- (only if EXPLAIN demands it — see 20260716100000_calendar_range_fn.sql)
```

## 3. First-workspace resolution (hottest lookup in the app)

```sql
explain analyze
select * from public.workspaces
where owner_id = '<owner_id>' order by created_at asc limit 1;
```

Expect: `workspaces_owner_idx (owner_id, created_at)` — index scan, limit 1.

## 4. Task record page ordered by position

```sql
explain analyze
select id, position from public.records
where database_id = '<database_id>' order by position asc limit 200;
```

Expect: `records_database_idx` provides both the filter and the order — no sort
node in the plan.
