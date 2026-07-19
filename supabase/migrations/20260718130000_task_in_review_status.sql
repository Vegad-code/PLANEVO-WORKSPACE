-- Phase 2 Task 9 — four-column task board (founder override 2026-07-18).
-- The Tasks board gains an "In review" column, so the tasks.status CHECK
-- must accept the new enum value between in_progress and done.

alter table public.tasks
  drop constraint tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('not_started', 'in_progress', 'in_review', 'done', 'cancelled'));
