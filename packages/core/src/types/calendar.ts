import type { TaskStatus } from "./tasks";

export const CALENDAR_PALETTE_KEYS = [
  "lavender",
  "sage",
  "grape",
  "flamingo",
  "banana",
  "tangerine",
  "peacock",
  "graphite",
  "blueberry",
  "basil",
  "tomato",
  "rose",
  "sky",
  "teal",
  "amber",
  "plum",
] as const;

export type CalendarPaletteKey = (typeof CALENDAR_PALETTE_KEYS)[number];
export type CalendarColorValue = CalendarPaletteKey | `#${string}`;
/** @deprecated Use CalendarColorValue. */
export type CalendarColor = CalendarColorValue;
export type CalendarColorMode = "inherit_override" | "required_per_event";
export type CalendarSurfaceView = "day" | "week" | "month" | "year";
export type CalendarContext =
  | { kind: "main" }
  | { kind: "calendar"; calendarId: string };
export type CalendarEmbedTarget = CalendarContext;
export type CalendarExternalProvider = "ics" | "google";

export type CalendarConnectionSummary = {
  id: string;
  provider: CalendarExternalProvider;
  last_synced_at: string | null;
  last_sync_error: string | null;
  is_enabled: boolean;
};

export type CalendarRow = {
  id: string;
  user_id: string;
  name: string;
  color: CalendarColorValue;
  color_mode: CalendarColorMode;
  is_main: boolean;
  is_included_in_main: boolean;
  /** Default write target for new events and task scheduling. One per user. */
  is_default: boolean;
  deleted_at: string | null;
  purge_after: string | null;
  position: number;
  created_at: string;
  /** Present only on product reads that request connection-safe metadata. */
  connection?: CalendarConnectionSummary | null;
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
  color: CalendarColorValue | null;
  conference_url: string | null;
  all_day: boolean;
  location: string | null;
  description_json: Record<string, unknown>;
  task_id: string | null;
  google_event_id: string | null;
  external_connection_id: string | null;
  external_event_id: string | null;
  external_etag: string | null;
  external_updated_at: string | null;
  source: "planevo" | CalendarExternalProvider;
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

export type TaskCalendarAssignmentRow = {
  task_id: string;
  calendar_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** A task due date rendered on the calendar without a calendar_events row. */
export type TaskDueChip = {
  taskId: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
};
