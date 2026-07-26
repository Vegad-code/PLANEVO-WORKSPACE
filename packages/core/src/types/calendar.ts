export const CALENDAR_COLORS = [
  "slate",
  "marigold",
  "meadow",
  "brick",
  "ocean",
] as const;

export type CalendarColor = (typeof CALENDAR_COLORS)[number];

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
  config: Record<string, unknown>;
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
  all_day: boolean;
  location: string | null;
  description_json: Record<string, unknown>;
  task_id: string | null;
  google_event_id: string | null;
  source: "planevo" | "google";
  created_at: string;
  updated_at: string;
};

/** A task due date rendered on the calendar without a calendar_events row. */
export type TaskDueChip = {
  taskId: string;
  title: string;
  dueAt: string;
  status: string;
};
