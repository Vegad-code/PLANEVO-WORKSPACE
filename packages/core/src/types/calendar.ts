import type { TaskStatus } from "./tasks";

export const CALENDAR_COLORS = [
  "slate",
  "marigold",
  "meadow",
  "brick",
  "ocean",
] as const;

export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export type CalendarViewConfigValue =
  | string
  | number
  | boolean
  | null
  | CalendarViewConfigValue[]
  | { [key: string]: CalendarViewConfigValue };

/**
 * Persisted saved-view configuration contains only axes that differ from the
 * selected preset. Resolving those overrides into a complete renderer config is
 * deliberately a read concern.
 */
export type CalendarViewConfigOverrides = {
  [key: string]: CalendarViewConfigValue;
};

export type CalendarRow = {
  id: string;
  user_id: string;
  name: string;
  color: CalendarColor;
  is_visible: boolean;
  /** Default write target for new events and task scheduling. One per user. */
  is_default: boolean;
  position: number;
  created_at: string;
};

/**
 * A saved view: a lens over the event pool, not a property of one calendar.
 * `source_calendar_ids` empty means every visible calendar.
 *
 * Availability is never scoped to these sources — conflict detection reads the
 * whole pool. A view filters what is drawn, not what the user is busy with.
 */
export type CalendarViewRow = {
  id: string;
  user_id: string;
  name: string;
  preset: string;
  config: CalendarViewConfigOverrides;
  source_calendar_ids: string[];
  include_task_dues: boolean;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type CalendarEventRow = {
  id: string;
  calendar_id: string;
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  /** Authored wall-clock start; null means this is a legacy event. */
  starts_at_local: string | null;
  /** Authored wall-clock end; null means this is a legacy event. */
  ends_at_local: string | null;
  timezone: string | null;
  /** Intended elapsed duration, which remains stable through DST changes. */
  duration_minutes: number | null;
  /** RFC 5545 recurrence rule, populated only for a series master. */
  rrule: string | null;
  recurrence_end: string | null;
  parent_event_id: string | null;
  recurrence_id: string | null;
  is_exception: boolean;
  is_cancelled: boolean;
  deleted_at: string | null;
  /** Per-event color override; null inherits the calendar color. */
  color: string | null;
  conference_url: string | null;
  all_day: boolean;
  location: string | null;
  description_json: Record<string, unknown>;
  task_id: string | null;
  google_event_id: string | null;
  source: "planevo" | "google";
  created_at: string;
  updated_at: string;
};

export type CalendarLinkedTask = {
  id: string;
  title: string;
  status: TaskStatus;
  estimateMinutes: number | null;
};

/** Runtime projection used by renderers after task state is joined in. */
export type CalendarDisplayEvent = CalendarEventRow & {
  linked_task: CalendarLinkedTask | null;
};

/** A task due date rendered on the calendar without a calendar_events row. */
export type TaskDueChip = {
  taskId: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
};
