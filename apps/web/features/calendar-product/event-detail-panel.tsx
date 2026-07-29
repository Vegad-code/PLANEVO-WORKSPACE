"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListTodo, X } from "lucide-react";
import type {
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarRow,
  CalendarColorValue,
} from "@planevo/core/types/calendar";
import { defaultCalendarId } from "@/lib/calendar/default-calendar";
import { calendarEventDisplayRange } from "@/lib/calendar/calendar-event-display-range";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { Select } from "@/components/ui/select";
import {
  applyCaptureToForm,
  applyFormPatch,
  buildEventFormState,
  eventFormStatesEqual,
  formatEventFormDuration,
  resolveEventFormTimes,
  type EventFormState,
} from "@/lib/calendar/event-form-state";
import type { EventCapture } from "@/lib/calendar/parse-event-capture";
import { CalendarColorDot } from "./calendar-color-dot";
import { CalendarColorPicker } from "./calendar-color-picker";
import {
  EventCaptureModeToggle,
  type EventCaptureMode,
} from "./event-capture-mode-toggle";
import { EventDetailFields } from "./event-detail-fields";
import type { EventCrossLinkPanel } from "./event-cross-links";
import { EventQuickCaptureField } from "./event-quick-capture-field";
import { loadEventReminderAction } from "@/app/(workspace)/calendar/actions";

export type EventPanelSavePayload = {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  rrule: string | null;
  location: string | null;
  description: string;
  reminderOffsetMinutes: number | null;
  allDay: boolean;
  color: CalendarColorValue | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EventDetailPanelProps = {
  mode: "create" | "edit";
  calendars: CalendarRow[];
  defaultCalendarId?: string;
  event?: CalendarDisplayEvent | CalendarEventRow | null;
  initialRange?: { startsAt: string; endsAt: string };
  onClose: (options?: { force?: boolean }) => void;
  onSave: (payload: EventPanelSavePayload) => void;
  onDelete?: (
    event: CalendarEventRow,
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onCompleteLinkedTask?: (
    event: CalendarEventRow,
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onUnscheduleLinkedTask?: (
    event: CalendarEventRow,
  ) => Promise<{ ok: boolean; error?: string } | void>;
  onOpenCrossLink?: (panel: EventCrossLinkPanel) => void;
  isPending?: boolean;
  /** When set, fields are view-only and Save/Delete are blocked. */
  mutationBlockedMessage?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (
    payload: Pick<
      EventPanelSavePayload,
      | "title"
      | "startsAt"
      | "endsAt"
      | "calendarId"
      | "allDay"
      | "color"
    >,
  ) => void;
};

function readOnlyEventTime(event: CalendarEventRow): string {
  const range = calendarEventDisplayRange(event);
  if (!range) return "Time unavailable";
  const { start, end } = range;
  if (event.all_day) {
    const finalDay = new Date(end.getTime() - 1);
    const startLabel = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const endLabel = finalDay.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return startLabel === endLabel
      ? `${startLabel} · All day`
      : `${startLabel} – ${endLabel} · All day`;
  }
  return `${start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function EventDetailPanel({
  mode,
  calendars,
  defaultCalendarId: requestedDefaultCalendarId,
  event = null,
  initialRange,
  onClose,
  onSave,
  onDelete,
  onCompleteLinkedTask,
  onUnscheduleLinkedTask,
  onOpenCrossLink,
  isPending = false,
  mutationBlockedMessage = null,
  onDirtyChange,
  onDraftChange,
}: EventDetailPanelProps) {
  const isCreate = mode === "create";
  const writableCalendars = useMemo(
    () => calendars.filter((calendar) => !calendar.connection),
    [calendars],
  );
  const createCalendarId =
    requestedDefaultCalendarId &&
    writableCalendars.some(({ id }) => id === requestedDefaultCalendarId)
      ? requestedDefaultCalendarId
      : defaultCalendarId(writableCalendars);
  const reminderEventId = event?.id ?? null;
  const reminderEventSource = event?.source ?? null;
  const shouldLoadReminder =
    !isCreate &&
    reminderEventSource === "planevo" &&
    Boolean(reminderEventId && UUID_PATTERN.test(reminderEventId));

  /**
   * What the card opened with, frozen for its lifetime. The panel echoes its
   * times back up through `onDraftChange`, so a baseline that tracked
   * `initialRange` would rebuild the form — erasing the title — every time a
   * time changed. Identity is handled by the popover's key instead: a new create
   * session or a different event remounts this component with a fresh baseline.
   */
  const [baseline] = useState<EventFormState>(() =>
    buildEventFormState({
      mode,
      event,
      initialRange,
      defaultCalendarId: createCalendarId,
    }),
  );
  const initialCalendar = calendars.find(
    (calendar) =>
      calendar.id === (baseline.calendarId || createCalendarId),
  );
  const initialEventColor =
    event?.color ??
    (initialCalendar?.color_mode === "required_per_event"
      ? initialCalendar.color
      : null);

  const [form, setForm] = useState<EventFormState>(baseline);
  const [eventColor, setEventColor] = useState<CalendarColorValue | null>(
    initialEventColor,
  );
  const [baselineEventColor] = useState<CalendarColorValue | null>(
    isCreate ? initialEventColor : (event?.color ?? null),
  );
  const [captureLine, setCaptureLine] = useState("");
  const [captureMode, setCaptureMode] = useState<EventCaptureMode>(
    isCreate ? "quick" : "details",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkedActionPending, setLinkedActionPending] = useState(false);
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<
    number | null
  >(null);
  const [reminderLoaded, setReminderLoaded] = useState(!shouldLoadReminder);
  const [baselineReminderOffsetMinutes, setBaselineReminderOffsetMinutes] =
    useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const isQuick = captureMode === "quick";
  const resolvedTimes = resolveEventFormTimes(form);
  const durationLabel = formatEventFormDuration(form);
  const draftStartsAt = resolvedTimes.ok ? resolvedTimes.startsAt : null;
  const draftEndsAt = resolvedTimes.ok ? resolvedTimes.endsAt : null;

  // Calendars arrive async, so the form may have been seeded before there was a
  // default to seed with. Derived rather than back-filled by an effect: an empty
  // `form.calendarId` just means "the user has not picked one".
  const selectedCalendarId = form.calendarId || createCalendarId;
  const selectedCalendar = calendars.find(
    (calendar) => calendar.id === selectedCalendarId,
  );
  const linkedTask =
    event && "linked_task" in event ? event.linked_task : null;
  const hasLinkedTask = Boolean(event?.task_id);
  const linkedTaskTitle = linkedTask?.title ?? event?.title ?? "Task";
  const linkedTaskComplete =
    linkedTask?.status === "done" || linkedTask?.status === "cancelled";

  /** The slot the card opened with — what quick capture keeps for anything unsaid. */
  const captureFallback = useMemo(() => {
    const times = resolveEventFormTimes(baseline);
    return times.ok
      ? { startsAt: times.startsAt, endsAt: times.endsAt }
      : null;
  }, [baseline]);

  // A parse the user never asked for is not an unsaved edit. Only count the
  // typed line and hand-edited fields, or closing an untouched card nags.
  const reminderDirty =
    reminderOffsetMinutes !== baselineReminderOffsetMinutes;
  const isDirty =
    (isQuick
      ? captureLine.trim().length > 0
      : !eventFormStatesEqual(form, baseline)) ||
    reminderDirty ||
    eventColor !== baselineEventColor;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (isQuick) return;
    titleRef.current?.focus();
  }, [isQuick]);

  useEffect(() => {
    if (!shouldLoadReminder || !reminderEventId) return;
    let active = true;
    void loadEventReminderAction({ eventId: reminderEventId }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setBaselineReminderOffsetMinutes(result.data.offsetMinutes);
        setReminderOffsetMinutes(result.data.offsetMinutes);
        setReminderLoaded(true);
        return;
      }
      setReminderLoaded(true);
      setValidationError(result.error);
    });
    return () => {
      active = false;
    };
  }, [reminderEventId, shouldLoadReminder]);

  // Keeps the grid block in step with the card before a create or edit is saved.
  useEffect(() => {
    if (!onDraftChange || !draftStartsAt || !draftEndsAt) return;
    onDraftChange({
      title: form.title,
      startsAt: draftStartsAt,
      endsAt: draftEndsAt,
      calendarId: selectedCalendarId,
      allDay: form.allDay,
      color: eventColor,
    });
  }, [
    onDraftChange,
    form.title,
    form.allDay,
    selectedCalendarId,
    draftStartsAt,
    draftEndsAt,
    eventColor,
  ]);

  function handleFormChange(patch: Partial<EventFormState>) {
    setForm((current) => applyFormPatch(current, patch));
    if (patch.rrule) setReminderOffsetMinutes(null);
    setValidationError(null);
  }

  function handleCapture(capture: EventCapture) {
    setForm((current) => applyCaptureToForm(current, capture));
    setValidationError(null);
  }

  const mutationBlocked = Boolean(mutationBlockedMessage);

  function requestClose() {
    // Create discards straight away (Google Calendar). Edit confirms if dirty.
    if (!isCreate && isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose({ force: true });
  }

  function confirmDiscard() {
    setDiscardOpen(false);
    onClose({ force: true });
  }

  function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setValidationError("Add a title before saving.");
      return;
    }
    if (!selectedCalendarId) {
      setValidationError("Create a Planevo calendar before saving.");
      return;
    }
    if (!resolvedTimes.ok) {
      setValidationError(resolvedTimes.error);
      return;
    }
    if (
      selectedCalendar?.color_mode === "required_per_event" &&
      eventColor === null
    ) {
      setValidationError("Choose an event color for this calendar.");
      return;
    }

    setValidationError(null);
    onSave({
      calendarId: selectedCalendarId,
      title: trimmedTitle,
      startsAt: resolvedTimes.startsAt,
      endsAt: resolvedTimes.endsAt,
      startsAtLocal: resolvedTimes.startsAtLocal,
      endsAtLocal: resolvedTimes.endsAtLocal,
      timezone: resolvedTimes.timezone,
      durationMinutes: resolvedTimes.durationMinutes,
      rrule: form.rrule,
      location: form.location.trim() || null,
      description: form.description.trim(),
      reminderOffsetMinutes,
      allDay: resolvedTimes.allDay,
      color: eventColor,
    });
  }

  const canSave =
    !isPending &&
    !mutationBlocked &&
    Boolean(form.title.trim()) &&
    writableCalendars.length > 0;

  async function handleReminderChange(offsetMinutes: number | null) {
    if (offsetMinutes === null) {
      setReminderOffsetMinutes(null);
      return;
    }
    if (typeof Notification === "undefined") {
      setValidationError("This browser does not support notifications.");
      return;
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      setValidationError(
        "Allow notifications in your browser before adding a reminder.",
      );
      return;
    }
    setValidationError(null);
    setReminderOffsetMinutes(offsetMinutes);
  }

  if (!isCreate && event && event.source !== "planevo") {
    const description =
      typeof event.description_json.text === "string"
        ? event.description_json.text
        : null;
    const provider =
      event.source === "google" ? "Google Calendar" : "Subscribed calendar";
    return (
      <div className="flex flex-col gap-2 p-2">
        <header className="flex shrink-0 items-center gap-2 pl-1">
          <CalendarColorDot
            color={eventColor ?? selectedCalendar?.color ?? "graphite"}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-product-meta font-medium text-text-secondary">
              {selectedCalendar?.name ?? provider}
            </span>
            <span className="block text-label uppercase text-text-muted">
              {provider} · Read-only
            </span>
          </span>
          <button
            type="button"
            aria-label="Close event details"
            onClick={() => onClose({ force: true })}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </header>
        <section className="event-card-surface flex flex-col gap-3 rounded-xl p-3">
          <h3 className="text-h3 font-medium text-ink">{event.title}</h3>
          <p className="text-product-body text-text-secondary">
            {readOnlyEventTime(event)}
          </p>
          {event.location ? (
            <p className="text-product-meta text-text-secondary">
              {event.location}
            </p>
          ) : null}
          {description ? (
            <p className="whitespace-pre-wrap text-product-meta leading-relaxed text-text-secondary">
              {description}
            </p>
          ) : null}
        </section>
        <p className="px-1 text-label text-text-muted">
          Changes from the connected calendar will appear after the next sync.
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
        <header className="flex shrink-0 items-center gap-2 pl-1">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarColorDot
              color={eventColor ?? selectedCalendar?.color ?? "graphite"}
            />
            {writableCalendars.length > 1 ? (
              <Select
                aria-label="Calendar"
                value={selectedCalendarId}
                onChange={(changeEvent) => {
                  const calendarId = changeEvent.target.value;
                  const nextCalendar = calendars.find(
                    (calendar) => calendar.id === calendarId,
                  );
                  handleFormChange({ calendarId });
                  if (
                    eventColor === null &&
                    nextCalendar?.color_mode === "required_per_event"
                  ) {
                    setEventColor(nextCalendar.color);
                  }
                }}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-product-meta font-medium shadow-none focus:border-0"
              >
                {writableCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="truncate text-product-meta font-medium text-text-secondary">
                {selectedCalendar?.name ?? "New event"}
              </span>
            )}
          </span>

          {isCreate ? (
            <EventCaptureModeToggle
              mode={captureMode}
              onModeChange={setCaptureMode}
            />
          ) : null}

          <button
            type="button"
            aria-label="Close event editor"
            onClick={requestClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </header>

        <div className="event-card-surface overflow-hidden rounded-xl">
          <fieldset
            disabled={mutationBlocked}
            className="min-w-0 border-0 p-0 disabled:opacity-80"
          >
            {isQuick && captureFallback ? (
              <EventQuickCaptureField
                value={captureLine}
                onValueChange={setCaptureLine}
                onCapture={handleCapture}
                fallbackStartsAt={captureFallback.startsAt}
                fallbackEndsAt={captureFallback.endsAt}
                autoFocus
              />
            ) : (
              <EventDetailFields
                form={form}
                onFormChange={handleFormChange}
                calendars={writableCalendars}
                durationLabel={durationLabel}
                reminderOffsetMinutes={reminderOffsetMinutes}
                onReminderChange={(offset) => void handleReminderChange(offset)}
                reminderDisabled={Boolean(form.rrule)}
                reminderLoading={!reminderLoaded}
                showCrossLinks={!isCreate && Boolean(event) && !mutationBlocked}
                taskLinked={hasLinkedTask}
                titleReadOnly={hasLinkedTask}
                onOpenCrossLink={onOpenCrossLink}
                titleRef={titleRef}
              />
            )}
          </fieldset>
          {/* Quick capture stays minimal — color overrides live on Details/Main. */}
          {!isQuick ? (
            <div className="border-t border-border p-3">
              {selectedCalendar?.color_mode !== "required_per_event" ? (
                <button
                  type="button"
                  aria-pressed={eventColor === null}
                  onClick={() => setEventColor(null)}
                  className={`mb-3 text-product-meta font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    eventColor === null
                      ? "text-ink"
                      : "text-text-secondary hover:text-ink"
                  }`}
                >
                  Use calendar color
                </button>
              ) : null}
              <CalendarColorPicker
                value={eventColor ?? selectedCalendar?.color ?? "graphite"}
                onChange={setEventColor}
                label="Event color"
              />
            </div>
          ) : null}
        </div>

        {!isCreate && event && hasLinkedTask ? (
          <section
            aria-label={`Linked task: ${linkedTaskTitle}`}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2"
          >
            <ListTodo
              aria-hidden="true"
              className="size-4 shrink-0 text-text-secondary"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-product-meta font-medium text-ink">
                {linkedTaskTitle}
              </span>
              <span className="block text-product-meta text-text-muted">
                {linkedTaskComplete ? "Completed task" : "Linked task"}
              </span>
            </span>
            {event.task_id ? (
              <Link
                href={`/tasks?highlight=${event.task_id}`}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-product-meta font-medium text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Open in Tasks
              </Link>
            ) : null}
            {!linkedTaskComplete && onCompleteLinkedTask ? (
              <button
                type="button"
                disabled={isPending || linkedActionPending}
                aria-label={`Complete task: ${linkedTaskTitle}`}
                onClick={async () => {
                  setLinkedActionPending(true);
                  setValidationError(null);
                  try {
                    const result = await onCompleteLinkedTask(event);
                    if (result && !result.ok) {
                      setValidationError(
                        result.error ?? "Could not complete the task.",
                      );
                    } else {
                      onClose({ force: true });
                    }
                  } finally {
                    setLinkedActionPending(false);
                  }
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-product-meta font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                <Check aria-hidden="true" className="size-3.5" />
                Complete
              </button>
            ) : null}
          </section>
        ) : null}

        {mutationBlockedMessage ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-meta text-text-secondary"
          >
            {mutationBlockedMessage}
          </p>
        ) : null}

        {validationError ? (
          <p
            role="alert"
            className="rounded-lg border border-brick bg-brick-tint px-3 py-2 text-product-meta text-ink"
          >
            {validationError}
          </p>
        ) : null}

        <footer className="flex shrink-0 items-center justify-between gap-2 pl-1">
          <div>
            {!isCreate &&
            event &&
            !mutationBlocked &&
            (hasLinkedTask ? onUnscheduleLinkedTask : onDelete) ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={isPending || linkedActionPending}
                className="rounded-lg px-2 py-1.5 text-product-meta font-medium text-brick outline-none hover:bg-brick-tint focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
              >
                {hasLinkedTask ? "Unschedule" : "Delete"}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={requestClose}
              disabled={isPending}
              className="rounded-lg px-2.5 py-1.5 text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-ink px-3 py-1.5 text-product-meta font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </form>

      {!isCreate &&
      event &&
      !mutationBlocked &&
      (hasLinkedTask ? onUnscheduleLinkedTask : onDelete) ? (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title={hasLinkedTask ? "Unschedule task?" : "Delete event?"}
          description={
            hasLinkedTask
              ? "This removes the time block from your calendar. The task stays in Tasks and returns to the backlog."
              : "This permanently removes the event from your calendar."
          }
          confirmLabel={hasLinkedTask ? "Unschedule task" : "Delete event"}
          onConfirm={async () => {
            const result = hasLinkedTask
              ? await onUnscheduleLinkedTask?.(event)
              : await onDelete?.(event);
            if (result && !result.ok) {
              return {
                ok: false as const,
                error: result.error ?? "Could not delete.",
              };
            }
            return { ok: true as const };
          }}
          onSuccess={() => onClose({ force: true })}
        />
      ) : null}

      <ConfirmActionDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard unsaved changes?"
        description="Your edits will be lost."
        confirmLabel="Discard"
        destructive
        onConfirm={async () => ({ ok: true as const })}
        onSuccess={confirmDiscard}
      />
    </>
  );
}
