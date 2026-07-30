"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import type {
  CalendarContext,
  CalendarDisplayEvent,
  CalendarEventRow,
} from "@planevo/core/types/calendar"
import {
  completeTaskLinkedEventAction,
  createCalendarEventAction,
  deleteCalendarEventAction,
  deleteRecurringEventAction,
  type RecurrenceMutationScope,
  setTaskStatusAction,
  unscheduleTaskLinkedEventAction,
  updateCalendarEventAction,
  updateEventTimesAction,
  updateRecurringEventAction,
} from "@/app/(workspace)/calendar/actions"
import { toast } from "@/components/ui/toast"
import { CalendarGridEngine } from "@/features/calendar-product/calendar-grid-engine"
import { CalendarNowProvider } from "@/features/calendar-product/calendar-now-context"
import { EmbeddedCalendarSkeleton } from "@/features/calendar-product/calendar-product-skeleton"
import {
  EventDetailPanel,
  type EventPanelSavePayload,
} from "@/features/calendar-product/event-detail-panel"
import { EventDetailPopover } from "@/features/calendar-product/event-detail-popover"
import { EventRecurrenceScopeDialog } from "@/features/calendar-product/event-recurrence-scope-dialog"
import type { CalendarQueryPayload } from "@/lib/calendar/fetch-calendar-page-data"
import { calendarHref } from "@/lib/calendar/calendar-context"
import { parseCalendarEmbedTarget } from "@/lib/calendar/embedded-calendar"
import {
  allowCreateFromPointerGesture,
  armCreateGestureSuppress,
  clearCreateGestureSuppress,
  initialCreateGestureSuppressState,
  scheduleCreateGestureSuppressClear,
  shouldArmSuppressOnOutsidePointer,
} from "@/lib/calendar/create-gesture-suppress"
import { resolveEventMutationTarget } from "@/lib/calendar/event-mutation-target"
import { recurrenceMutationPayload } from "@/lib/calendar/recurrence-mutation-payload"
import {
  previewCalendarEvent,
  type EventDraftPreview,
} from "@/lib/calendar/calendar-query-optimistic"
import {
  formatToolbarTitle,
  goToToday,
  stepAnchor,
} from "@/lib/calendar/calendar-navigation"
import { dateParam, parseCalendarDate } from "@/lib/calendar/calendar-range"

type EmbeddedCalendarPayload = {
  target: CalendarContext
  data: CalendarQueryPayload
}

type EditorState =
  | {
      mode: "create"
      startsAt: string
      endsAt: string
      anchorRect: DOMRect
    }
  | {
      mode: "edit"
      event: CalendarDisplayEvent
      anchorRect: DOMRect
    }
  | null

type PendingRecurrenceMutation =
  | {
      kind: "save"
      event: CalendarEventRow
      payload: EventPanelSavePayload
    }
  | { kind: "delete"; event: CalendarEventRow }
  | {
      kind: "move"
      operation: "move" | "resize"
      event: CalendarEventRow
      startsAt: string
      endsAt: string
    }

export type EmbeddedCalendarViewProps = {
  targetKind: string
  calendarId?: string
  legacyViewId?: string
  view?: string
  height?: string
}

export function EmbeddedCalendarView({
  targetKind,
  calendarId = "",
  legacyViewId = "",
  view: initialView = "month",
  height = "standard",
}: EmbeddedCalendarViewProps) {
  const target = useMemo(
    () =>
      legacyViewId.trim()
        ? null
        : parseCalendarEmbedTarget({ targetKind, calendarId }),
    [calendarId, legacyViewId, targetKind],
  )
  const [view, setView] = useState<"day" | "week" | "month">(
    initialView === "day" || initialView === "week"
      ? initialView
      : "month",
  )
  const [anchor, setAnchor] = useState(() => goToToday())
  const [payload, setPayload] = useState<EmbeddedCalendarPayload | null>(null)
  const [status, setStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading")
  const [editor, setEditor] = useState<EditorState>(null)
  const [eventDraftPreview, setEventDraftPreview] =
    useState<EventDraftPreview | null>(null)
  const [pendingRecurrence, setPendingRecurrence] =
    useState<PendingRecurrenceMutation | null>(null)
  const [recurrencePending, startRecurrenceTransition] = useTransition()
  const panelDismissRef = useRef<(() => void) | null>(null)
  const createGestureSuppressRef = useRef(initialCreateGestureSuppressState())
  const editorRef = useRef(editor)
  editorRef.current = editor
  const providePanelDismiss = useCallback((dismiss: (() => void) | null) => {
    panelDismissRef.current = dismiss
  }, [])
  const armCreateSuppressForOutsidePointer = useCallback(() => {
    createGestureSuppressRef.current = armCreateGestureSuppress(
      createGestureSuppressRef.current,
    )
    scheduleCreateGestureSuppressClear({
      onClear: () => {
        createGestureSuppressRef.current = clearCreateGestureSuppress(
          createGestureSuppressRef.current,
        )
      },
    })
  }, [])
  const closeEditor = useCallback((options?: { force?: boolean }) => {
    if (!options?.force && panelDismissRef.current) {
      panelDismissRef.current()
      return
    }
    setEditor(null)
    setEventDraftPreview(null)
  }, [])
  const normalizedHeight =
    height === "compact" || height === "tall" ? height : "standard"

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!target) {
        setStatus("missing")
        return
      }
      setStatus("loading")
      const params = new URLSearchParams({
        targetKind: target.kind,
        view,
        date: dateParam(anchor),
      })
      if (target.kind === "calendar") {
        params.set("calendarId", target.calendarId)
      }
      try {
        const response = await fetch(
          `/api/embedded-calendar?${params.toString()}`,
          { cache: "no-store", signal },
        )
        if (signal?.aborted) return
        if (response.status === 404) {
          setStatus("missing")
          return
        }
        if (!response.ok) throw new Error("Unable to load calendar.")
        setPayload((await response.json()) as EmbeddedCalendarPayload)
        setStatus("ready")
      } catch {
        if (!signal?.aborted) setStatus("error")
      }
    },
    [anchor, target, view],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void load(controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])

  async function saveEvent(eventPayload: EventPanelSavePayload) {
    if (editor?.mode === "edit") {
      const mutationTarget = resolveEventMutationTarget(editor.event)
      if (!mutationTarget) {
        toast("This event has an invalid recurrence identity.", {
          tone: "error",
        })
        return
      }
      if (mutationTarget.kind !== "standalone") {
        setPendingRecurrence({
          kind: "save",
          event: editor.event,
          payload: eventPayload,
        })
        return
      }
    }

    const result =
      editor?.mode === "edit"
        ? await updateCalendarEventAction({
            eventId: editor.event.id,
            ...eventPayload,
          })
        : await createCalendarEventAction(eventPayload)
    if (!result.ok) {
      toast(result.error, { tone: "error" })
      return
    }
    setEditor(null)
    setEventDraftPreview(null)
    await load()
  }

  function executePendingRecurrence(scope: RecurrenceMutationScope) {
    const pending = pendingRecurrence
    if (!pending) return
    const mutationTarget = resolveEventMutationTarget(pending.event)
    if (!mutationTarget || mutationTarget.kind === "standalone") {
      setPendingRecurrence(null)
      toast("This event has an invalid recurrence identity.", {
        tone: "error",
      })
      return
    }
    const recurrenceId =
      mutationTarget.kind === "series-master"
        ? pending.event.starts_at
        : mutationTarget.recurrenceId

    startRecurrenceTransition(async () => {
      const result =
        pending.kind === "delete"
          ? await deleteRecurringEventAction({
              masterId: mutationTarget.masterId,
              recurrenceId,
              operationKey: crypto.randomUUID(),
              scope,
            })
          : await updateRecurringEventAction({
              masterId: mutationTarget.masterId,
              recurrenceId,
              operationKey: crypto.randomUUID(),
              scope,
              ...recurrenceMutationPayload(pending),
            })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      setPendingRecurrence(null)
      setEditor(null)
      setEventDraftPreview(null)
      await load()
    })
  }

  if (status === "missing" || !target) {
    return (
      <div
        className="calendar-embed calendar-embed--placeholder"
        data-height={normalizedHeight}
      >
        <p className="text-product-body font-medium text-ink">
          Calendar unavailable
        </p>
        <p className="mt-1 text-product-meta text-text-muted">
          Choose another calendar or remove this block.
        </p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="calendar-embed calendar-embed--placeholder"
        data-height={normalizedHeight}
      >
        Unable to load calendar.
      </div>
    )
  }

  if (!payload) {
    return <EmbeddedCalendarSkeleton view={view} height={normalizedHeight} anchor={anchor} />
  }

  const activeCalendar =
    target.kind === "main"
      ? payload.data.calendars.find(({ is_main }) => is_main)
      : payload.data.calendars.find(({ id }) => id === target.calendarId)
  const selectedEvent =
    editor?.mode === "edit"
      ? payload.data.events.find(({ id }) => id === editor.event.id) ??
        editor.event
      : null
  const readOnlyCalendar = Boolean(activeCalendar?.connection)
  const displayEvents =
    editor?.mode === "edit" &&
    eventDraftPreview?.eventId === editor.event.id
      ? previewCalendarEvent(payload.data.events, eventDraftPreview)
      : payload.data.events
  const renderedAnchor = parseCalendarDate(payload.data.anchorDate)
  const renderedView =
    payload.data.view === "day" || payload.data.view === "week"
      ? payload.data.view
      : "month"

  return (
    <CalendarNowProvider>
      <section
        className="calendar-embed"
        data-height={normalizedHeight}
        data-calendar-embed={
          target.kind === "main" ? "main" : target.calendarId
        }
        aria-label={`${activeCalendar?.name ?? "Main"} calendar`}
        aria-busy={status === "loading"}
      >
        <header className="calendar-embed-header flex-wrap gap-2">
          <div className="min-w-0">
            <p className="truncate text-product-body font-semibold text-ink">
              {target.kind === "main"
                ? "Main Calendar"
                : activeCalendar?.name ?? "Calendar"}
            </p>
            <p className="text-product-meta text-text-muted">
              {formatToolbarTitle(anchor, view)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setStatus("loading")
                setAnchor(stepAnchor(view, anchor, -1))
              }}
              aria-label="Previous"
              className="rounded-md px-2 py-1 text-product-meta text-text-secondary hover:bg-surface-raised"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("loading")
                setAnchor(goToToday())
              }}
              className="rounded-md px-2 py-1 text-product-meta text-text-secondary hover:bg-surface-raised"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("loading")
                setAnchor(stepAnchor(view, anchor, 1))
              }}
              aria-label="Next"
              className="rounded-md px-2 py-1 text-product-meta text-text-secondary hover:bg-surface-raised"
            >
              ›
            </button>
            {(["day", "week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => {
                  setStatus("loading")
                  setView(option)
                }}
                className={`rounded-md px-2 py-1 text-product-meta capitalize ${
                  view === option
                    ? "bg-ink text-paper"
                    : "text-text-secondary hover:bg-surface-raised"
                }`}
              >
                {option}
              </button>
            ))}
            <a
              href={calendarHref(target)}
              className="ml-1 text-product-meta text-text-secondary hover:text-ink"
            >
              Open
            </a>
          </div>
        </header>
        <div className="calendar-embed-surface">
          <CalendarGridEngine
            view={renderedView}
            anchor={renderedAnchor}
            calendars={payload.data.calendars}
            events={displayEvents}
            taskDues={[]}
            onSlotSelect={(range, anchorRect) => {
              if (readOnlyCalendar) return
              if (
                !allowCreateFromPointerGesture({
                  suppress: createGestureSuppressRef.current,
                })
              ) {
                return
              }
              setEditor({
                mode: "create",
                startsAt: range.startsAt.toISOString(),
                endsAt: range.endsAt.toISOString(),
                anchorRect,
              })
              setEventDraftPreview(null)
            }}
            onEventSelect={(event, anchorRect) => {
              setEventDraftPreview(null)
              setEditor({
                mode: "edit",
                event: event as CalendarDisplayEvent,
                anchorRect,
              })
            }}
            onEventTimesChange={(input) => {
              if (readOnlyCalendar) return
              const mutationTarget = resolveEventMutationTarget(input.event)
              if (!mutationTarget) {
                toast("This event has an invalid recurrence identity.", {
                  tone: "error",
                })
                return
              }
              if (mutationTarget.kind !== "standalone") {
                setPendingRecurrence({ kind: "move", ...input })
                return
              }
              void updateEventTimesAction({
                eventId: mutationTarget.eventId,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
              }).then(async (result) => {
                if (!result.ok) {
                  toast(result.error, { tone: "error" })
                  return
                }
                await load()
              })
            }}
            onToggleTask={(taskId, done) => {
              void setTaskStatusAction({
                taskId,
                status: done ? "done" : "not_started",
              }).then(async (result) => {
                if (!result.ok) {
                  toast(result.error, { tone: "error" })
                  return
                }
                await load()
              })
            }}
            onUnscheduleTaskEvent={(event) => {
              if (readOnlyCalendar) return
              void unscheduleTaskLinkedEventAction({
                eventId: event.id,
              }).then(async (result) => {
                if (!result.ok) {
                  toast(result.error, { tone: "error" })
                  return
                }
                await load()
              })
            }}
            onOpenDay={(date) => {
              setStatus("loading")
              setAnchor(date)
              setView("day")
            }}
            onNavigateMonth={(offset) => {
              setStatus("loading")
              setAnchor(stepAnchor("month", anchor, offset > 0 ? 1 : -1))
            }}
          />
          {status === "loading" ? (
            <div
              aria-hidden="true"
              className="calendar-embed-loading-veil"
            >
              <span className="calendar-skeleton-placeholder h-2 w-24 rounded-full bg-paper" />
            </div>
          ) : null}
        </div>
      </section>

      {editor ? (
        <EventDetailPopover
          anchorRect={editor.anchorRect}
          onClose={(meta) => {
            if (
              meta?.reason === "outside-pointer" &&
              shouldArmSuppressOnOutsidePointer({
                panelOpen: editorRef.current !== null,
              })
            ) {
              armCreateSuppressForOutsidePointer()
            }
            closeEditor()
          }}
        >
          <EventDetailPanel
            mode={editor.mode}
            calendars={payload.data.calendars}
            defaultCalendarId={activeCalendar?.id}
            event={selectedEvent}
            initialRange={
              editor.mode === "create"
                ? {
                    startsAt: editor.startsAt,
                    endsAt: editor.endsAt,
                  }
                : undefined
            }
            onClose={closeEditor}
            onProvideDismiss={providePanelDismiss}
            onSave={(next) => void saveEvent(next)}
            onDraftChange={
              editor.mode === "edit"
                ? (fields) =>
                    setEventDraftPreview({
                      eventId: editor.event.id,
                      fields,
                    })
                : undefined
            }
            mutationBlockedMessage={
              readOnlyCalendar
                ? "Connected calendar events are read-only."
                : null
            }
            onDelete={
              editor.mode === "edit" && !readOnlyCalendar
                ? async (event) => {
                    const mutationTarget = resolveEventMutationTarget(event)
                    if (!mutationTarget) {
                      return {
                        ok: false,
                        error:
                          "This event has an invalid recurrence identity.",
                      }
                    }
                    if (mutationTarget.kind !== "standalone") {
                      setPendingRecurrence({ kind: "delete", event })
                      return
                    }
                    const result = await deleteCalendarEventAction({
                      eventId: event.id,
                    })
                    if (result.ok) {
                      setEditor(null)
                      setEventDraftPreview(null)
                      await load()
                    }
                    return result
                  }
                : undefined
            }
            onCompleteLinkedTask={
              editor.mode === "edit" && !readOnlyCalendar
                ? async (event) => {
                    const result = await completeTaskLinkedEventAction({
                      eventId: event.id,
                    })
                    if (result.ok) await load()
                    return result
                  }
                : undefined
            }
            onUnscheduleLinkedTask={
              editor.mode === "edit" && !readOnlyCalendar
                ? async (event) => {
                    const result = await unscheduleTaskLinkedEventAction({
                      eventId: event.id,
                    })
                    if (result.ok) {
                      setEditor(null)
                      setEventDraftPreview(null)
                      await load()
                    }
                    return result
                  }
                : undefined
            }
          />
        </EventDetailPopover>
      ) : null}

      <EventRecurrenceScopeDialog
        open={pendingRecurrence !== null}
        action={
          pendingRecurrence?.kind === "delete"
            ? "delete"
            : pendingRecurrence?.kind === "move"
              ? "move"
              : "edit"
        }
        isPending={recurrencePending}
        onClose={() => {
          if (!recurrencePending) setPendingRecurrence(null)
        }}
        onChoose={executePendingRecurrence}
      />
    </CalendarNowProvider>
  )
}
