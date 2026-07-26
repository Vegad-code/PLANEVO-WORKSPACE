"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ListTodo, X } from "lucide-react";
import type {
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar";
import { defaultCalendarId } from "@/lib/calendar/default-calendar";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
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
import {
  EventCaptureModeToggle,
  type EventCaptureMode,
} from "./event-capture-mode-toggle";
import { EventDetailFields } from "./event-detail-fields";
import type { EventCrossLinkPanel } from "./event-cross-links";
import { EventQuickCaptureField } from "./event-quick-capture-field";

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
};

type EventDetailPanelProps = {
  mode: "create" | "edit";
  calendars: CalendarRow[];
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
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (
    payload: Pick<
      EventPanelSavePayload,
      "title" | "startsAt" | "endsAt" | "calendarId"
    >,
  ) => void;
};

export function EventDetailPanel({
  mode,
  calendars,
  event = null,
  initialRange,
  onClose,
  onSave,
  onDelete,
  onCompleteLinkedTask,
  onUnscheduleLinkedTask,
  onOpenCrossLink,
  isPending = false,
  onDirtyChange,
  onDraftChange,
}: EventDetailPanelProps) {
  const isCreate = mode === "create";
  const createCalendarId = defaultCalendarId(calendars);

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

  const [form, setForm] = useState<EventFormState>(baseline);
  const [captureLine, setCaptureLine] = useState("");
  const [captureMode, setCaptureMode] = useState<EventCaptureMode>(
    isCreate ? "quick" : "details",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkedActionPending, setLinkedActionPending] = useState(false);
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
  const isDirty = isQuick
    ? captureLine.trim().length > 0
    : !eventFormStatesEqual(form, baseline);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (isQuick) return;
    titleRef.current?.focus();
  }, [isQuick]);

  // Keeps the ghost block on the grid in step with the card while creating.
  useEffect(() => {
    if (!isCreate || !onDraftChange || !draftStartsAt || !draftEndsAt) return;
    onDraftChange({
      title: form.title,
      startsAt: draftStartsAt,
      endsAt: draftEndsAt,
      calendarId: selectedCalendarId,
    });
  }, [
    isCreate,
    onDraftChange,
    form.title,
    selectedCalendarId,
    draftStartsAt,
    draftEndsAt,
  ]);

  function handleFormChange(patch: Partial<EventFormState>) {
    setForm((current) => applyFormPatch(current, patch));
    setValidationError(null);
  }

  function handleCapture(capture: EventCapture) {
    setForm((current) => applyCaptureToForm(current, capture));
    setValidationError(null);
  }

  function requestClose() {
    // Create discards straight away (Google Calendar). Edit confirms if dirty.
    if (!isCreate && isDirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }
    onClose({ force: isCreate });
  }

  function handleSubmit(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setValidationError("Add a title before saving.");
      return;
    }
    if (!selectedCalendarId) {
      setValidationError("Choose a calendar before saving.");
      return;
    }
    if (!resolvedTimes.ok) {
      setValidationError(resolvedTimes.error);
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
    });
  }

  const canSave =
    !isPending && Boolean(form.title.trim()) && calendars.length > 0;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2">
        <header className="flex shrink-0 items-center gap-2 pl-1">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarColorDot color={selectedCalendar?.color ?? "ocean"} />
            {calendars.length > 1 ? (
              <Select
                aria-label="Calendar"
                value={selectedCalendarId}
                onChange={(changeEvent) =>
                  handleFormChange({ calendarId: changeEvent.target.value })
                }
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-product-meta font-medium shadow-none focus:border-0"
              >
                {calendars.map((calendar) => (
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
              calendars={calendars}
              durationLabel={durationLabel}
              showCrossLinks={!isCreate && Boolean(event)}
              taskLinked={hasLinkedTask}
              onOpenCrossLink={onOpenCrossLink}
              titleRef={titleRef}
            />
          )}
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
    </>
  );
}
