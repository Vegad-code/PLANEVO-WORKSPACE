-- Calendar range / recurrence / task-due indexes for faster product loads.
-- Complements existing (user_id, starts_at) WHERE deleted_at IS NULL.

CREATE INDEX IF NOT EXISTS calendar_events_user_starts_ends_live_idx
  ON public.calendar_events (user_id, starts_at, ends_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS calendar_events_recurrence_masters_live_idx
  ON public.calendar_events (user_id, recurrence_end, starts_at)
  WHERE deleted_at IS NULL
    AND rrule IS NOT NULL
    AND parent_event_id IS NULL;

CREATE INDEX IF NOT EXISTS calendar_events_parent_recurrence_live_idx
  ON public.calendar_events (parent_event_id, recurrence_id)
  WHERE deleted_at IS NULL
    AND parent_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_user_due_incomplete_idx
  ON public.tasks (user_id, due_at)
  WHERE status IS DISTINCT FROM 'done'
    AND status IS DISTINCT FROM 'cancelled';
