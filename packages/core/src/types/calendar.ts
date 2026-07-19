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
  position: number;
  created_at: string;
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
