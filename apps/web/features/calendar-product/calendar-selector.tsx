"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react"
import type {
  CalendarColorValue,
  CalendarContext,
  CalendarRow,
} from "@planevo/core/types/calendar"
import { calendarHref } from "@/lib/calendar/calendar-context"
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/calendar-color"
import {
  createCalendarWorkspacePageAction,
  disconnectCalendarAction,
  listTrashedCalendarsAction,
  restoreCalendarAction,
  trashCalendarAction,
  updateCalendarDetailsAction,
} from "@/app/(workspace)/calendar/actions"
import { toast } from "@/components/ui/toast"
import { CalendarColorDot } from "./calendar-color-dot"
import { CalendarColorPicker } from "./calendar-color-picker"

export function CalendarSelector({
  context,
  anchor,
  view,
  scope,
  calendars,
  onToggleIncluded,
  onCreateCalendar,
  onSetDefaultCalendar,
}: {
  context: CalendarContext
  anchor: Date
  view: "day" | "week" | "month" | "year"
  scope: "all" | "workspace"
  calendars: CalendarRow[]
  onToggleIncluded: (calendarId: string, included: boolean) => void
  onCreateCalendar: (
    name: string,
    color: CalendarColorValue,
  ) => Promise<string | null>
  onSetDefaultCalendar: (calendarId: string) => void
}) {
  const activeCalendar =
    context.kind === "main"
      ? calendars.find(({ is_main }) => is_main)
      : calendars.find(({ id }) => id === context.calendarId)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const [name, setName] = useState("")
  const [color, setColor] = useState<CalendarColorValue>(DEFAULT_CALENDAR_COLOR)
  const [submitting, setSubmitting] = useState(false)
  const [createdCalendarId, setCreatedCalendarId] = useState<string | null>(null)
  const [addingToWorkspace, setAddingToWorkspace] = useState(false)
  const [editColor, setEditColor] = useState<CalendarColorValue>(
    activeCalendar?.color ?? DEFAULT_CALENDAR_COLOR,
  )
  const [editColorMode, setEditColorMode] = useState<
    "inherit_override" | "required_per_event"
  >(activeCalendar?.color_mode ?? "inherit_override")
  const [editName, setEditName] = useState(activeCalendar?.name ?? "")
  const [moveEventsTo, setMoveEventsTo] = useState("")
  const [managingBusy, setManagingBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<
    "trash" | "disconnect" | null
  >(null)
  const [trashedCalendars, setTrashedCalendars] = useState<
    Array<{ id: string; name: string; purgeAfter: string }>
  >([])
  const nativeCalendars = calendars.filter(({ connection }) => !connection)
  const connectedCalendars = calendars.filter(({ connection }) => connection)
  const hrefFor = (target: CalendarContext) =>
    calendarHref(target, { scope, date: anchor, view })

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName || submitting) return
    setSubmitting(true)
    try {
      const calendarId = await onCreateCalendar(normalizedName, color)
      if (!calendarId) return
      setName("")
      setColor(DEFAULT_CALENDAR_COLOR)
      setCreating(false)
      setCreatedCalendarId(calendarId)
    } finally {
      setSubmitting(false)
    }
  }

  function sourceRows(rows: CalendarRow[]) {
    return rows.map((calendar) => {
      const selected =
        (context.kind === "main" && calendar.is_main) ||
        (context.kind === "calendar" &&
          context.calendarId === calendar.id)
      return (
        <li key={calendar.id} className="flex items-center gap-1">
          <Link
            href={hrefFor(
              calendar.is_main
                ? { kind: "main" }
                : { kind: "calendar", calendarId: calendar.id },
            )}
            onClick={() => setOpen(false)}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-product-body outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
              selected ? "font-medium text-ink" : "text-text-secondary"
            }`}
          >
            <CalendarColorDot color={calendar.color} />
            <span className="truncate">
              {calendar.is_main ? "Main Calendar" : calendar.name}
            </span>
            {calendar.connection ? (
              <span className="ml-auto text-product-meta text-text-muted">
                Read-only
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            disabled={calendar.is_main}
            aria-pressed={
              calendar.is_main || calendar.is_included_in_main
            }
            aria-label={`${
              calendar.is_included_in_main ? "Hide" : "Show"
            } ${calendar.name} on Main`}
            onClick={() =>
              onToggleIncluded(
                calendar.id,
                !calendar.is_included_in_main,
              )
            }
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default disabled:opacity-45"
          >
            {calendar.is_main || calendar.is_included_in_main ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : null}
          </button>
        </li>
      )
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex max-w-64 items-center gap-2 rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <CalendarColorDot color={activeCalendar?.color ?? DEFAULT_CALENDAR_COLOR} />
        <span className="truncate">
          {context.kind === "main"
            ? "Main Calendar"
            : activeCalendar?.name ?? "Calendar"}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close calendar menu"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="calendar-selector-menu absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-paper p-2 shadow-spotlight">
            <p className="px-2 py-1 text-product-meta font-medium text-text-muted">
              Calendars
            </p>
            <ul className="flex flex-col gap-0.5">
              {sourceRows(nativeCalendars)}
            </ul>
            {connectedCalendars.length > 0 ? (
              <>
                <p className="mt-2 border-t border-border px-2 pt-3 pb-1 text-product-meta font-medium text-text-muted">
                  Connected
                </p>
                <ul className="flex flex-col gap-0.5">
                  {sourceRows(connectedCalendars)}
                </ul>
              </>
            ) : null}

            {creating ? (
              <form
                onSubmit={submit}
                className="mt-2 flex flex-col gap-3 border-t border-border p-2 pt-3"
              >
                <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
                  Calendar name
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="rounded-md border border-border bg-paper px-2 py-1.5 text-product-body text-ink outline-none focus-visible:border-border-strong"
                  />
                </label>
                <CalendarColorPicker value={color} onChange={setColor} />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md px-2 py-1.5 text-product-meta text-text-secondary hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || submitting}
                    className="rounded-md bg-ink px-3 py-1.5 text-product-meta font-medium text-paper disabled:opacity-45"
                  >
                    Create
                  </button>
                </div>
              </form>
            ) : null}

            {createdCalendarId ? (
              <div
                role="status"
                className="mt-2 flex flex-col gap-2 border-t border-border p-2 pt-3"
              >
                <p className="text-product-meta font-medium text-ink">
                  Calendar created
                </p>
                <p className="text-product-meta text-text-muted">
                  Open it now or add a live editable embed to Workspace.
                </p>
                <div className="flex gap-2">
                  <Link
                    href={hrefFor({
                      kind: "calendar",
                      calendarId: createdCalendarId,
                    })}
                    className="rounded-md bg-ink px-3 py-1.5 text-product-meta font-medium text-paper"
                  >
                    Open calendar
                  </Link>
                  <button
                    type="button"
                    disabled={addingToWorkspace}
                    onClick={() => {
                      setAddingToWorkspace(true)
                      void createCalendarWorkspacePageAction({
                        calendarId: createdCalendarId,
                      }).then((result) => {
                        setAddingToWorkspace(false)
                        if (!result.ok) {
                          toast(result.error, { tone: "error" })
                          return
                        }
                        window.location.assign(`/pages/${result.data.pageId}`)
                      })
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-product-meta font-medium text-ink disabled:opacity-45"
                  >
                    Add to Workspace
                  </button>
                </div>
              </div>
            ) : null}

            {managing ? (
              <div className="mt-2 flex max-h-96 flex-col gap-3 overflow-y-auto border-t border-border p-2 pt-3">
                {activeCalendar ? (
                  <>
                    <div>
                      <p className="text-product-meta font-medium text-ink">
                        {activeCalendar.is_main
                          ? "Main Calendar appearance"
                          : `${activeCalendar.name} appearance`}
                      </p>
                      <p className="text-product-meta text-text-muted">
                        Calendar colors label events; the current view stays neutral.
                      </p>
                    </div>
                    <CalendarColorPicker
                      value={editColor}
                      onChange={setEditColor}
                    />
                    {!activeCalendar.is_main &&
                    !activeCalendar.connection ? (
                      <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
                        Calendar name
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="rounded-md border border-border bg-paper px-2 py-1.5 text-product-body text-ink outline-none focus-visible:border-border-strong"
                        />
                      </label>
                    ) : null}
                    {!activeCalendar.connection ? (
                      <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
                        Event colors
                        <select
                          value={editColorMode}
                          onChange={(event) =>
                            setEditColorMode(
                              event.target.value as
                                | "inherit_override"
                                | "required_per_event",
                            )
                          }
                          className="rounded-md border border-border bg-paper px-2 py-1.5 text-ink"
                        >
                          <option value="inherit_override">
                            Inherit calendar color, allow overrides
                          </option>
                          <option value="required_per_event">
                            Require a color for every event
                          </option>
                        </select>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      disabled={managingBusy}
                      onClick={() => {
                        setManagingBusy(true)
                        void updateCalendarDetailsAction({
                          calendarId: activeCalendar.id,
                          name: activeCalendar.is_main
                            ? "Main"
                            : editName.trim(),
                          color: editColor,
                          colorMode: editColorMode,
                        }).then((result) => {
                          setManagingBusy(false)
                          if (!result.ok) {
                            toast(result.error, { tone: "error" })
                            return
                          }
                          window.location.reload()
                        })
                      }}
                      className="self-start rounded-md bg-ink px-3 py-1.5 text-product-meta font-medium text-paper disabled:opacity-45"
                    >
                      Save appearance
                    </button>
                    <button
                      type="button"
                      disabled={addingToWorkspace}
                      onClick={() => {
                        setAddingToWorkspace(true)
                        void createCalendarWorkspacePageAction({
                          calendarId: activeCalendar.id,
                        }).then((result) => {
                          setAddingToWorkspace(false)
                          if (!result.ok) {
                            toast(result.error, { tone: "error" })
                            return
                          }
                          window.location.assign(`/pages/${result.data.pageId}`)
                        })
                      }}
                      className="self-start rounded-md border border-border px-3 py-2 text-product-meta font-medium text-ink disabled:opacity-45"
                    >
                      Add to Workspace
                    </button>
                  </>
                ) : null}
                <p className="mb-2 text-product-meta text-text-muted">
                  Default for tasks and events created outside Calendar
                </p>
                <div className="flex flex-col gap-1">
                  {nativeCalendars.map((calendar) => (
                    <button
                      key={calendar.id}
                      type="button"
                      disabled={calendar.is_default}
                      onClick={() => onSetDefaultCalendar(calendar.id)}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-product-meta text-ink hover:bg-surface-raised disabled:text-text-muted"
                    >
                      <span className="truncate">{calendar.name}</span>
                      <span>
                        {calendar.is_default ? "Default" : "Make default"}
                      </span>
                    </button>
                  ))}
                </div>
                {activeCalendar && !activeCalendar.is_main ? (
                  <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                    {activeCalendar.connection ? (
                      <>
                        <button
                          type="button"
                          disabled={managingBusy}
                          onClick={() => {
                            if (confirmRemove !== "disconnect") {
                              setConfirmRemove("disconnect")
                              return
                            }
                            setManagingBusy(true)
                            void disconnectCalendarAction({
                              calendarId: activeCalendar.id,
                            }).then((result) => {
                              if (!result.ok) {
                                setManagingBusy(false)
                                toast(result.error, { tone: "error" })
                                return
                              }
                              window.location.assign("/calendar")
                            })
                          }}
                          className="self-start rounded-md px-2 py-1.5 text-product-meta font-medium text-brick hover:bg-brick-tint disabled:opacity-45"
                        >
                          {confirmRemove === "disconnect"
                            ? "Confirm disconnect"
                            : "Disconnect calendar"}
                        </button>
                        {confirmRemove === "disconnect" ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="self-start rounded-md px-2 py-2 text-product-meta text-text-secondary"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col gap-1 text-product-meta text-text-secondary">
                          When moving to Trash
                          <select
                            value={moveEventsTo}
                            onChange={(event) =>
                              setMoveEventsTo(event.target.value)
                            }
                            className="rounded-md border border-border bg-paper px-2 py-1.5 text-ink"
                          >
                            <option value="">
                              Trash its events for 30 days
                            </option>
                            {nativeCalendars
                              .filter(
                                (calendar) =>
                                  calendar.id !== activeCalendar.id,
                              )
                              .map((calendar) => (
                                <option key={calendar.id} value={calendar.id}>
                                  Move events to {calendar.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={managingBusy}
                          onClick={() => {
                            if (confirmRemove !== "trash") {
                              setConfirmRemove("trash")
                              return
                            }
                            setManagingBusy(true)
                            void trashCalendarAction({
                              calendarId: activeCalendar.id,
                              moveEventsToCalendarId: moveEventsTo || null,
                            }).then((result) => {
                              if (!result.ok) {
                                setManagingBusy(false)
                                toast(result.error, { tone: "error" })
                                return
                              }
                              window.location.assign("/calendar")
                            })
                          }}
                          className="self-start rounded-md px-2 py-1.5 text-product-meta font-medium text-brick hover:bg-brick-tint disabled:opacity-45"
                        >
                          {confirmRemove === "trash"
                            ? "Confirm move to Trash"
                            : "Move calendar to Trash"}
                        </button>
                        {confirmRemove === "trash" ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="self-start rounded-md px-2 py-2 text-product-meta text-text-secondary"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
                {trashedCalendars.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-1 border-t border-border pt-3">
                    <p className="text-product-meta font-medium text-ink">
                      Trash
                    </p>
                    {trashedCalendars.map((calendar) => (
                      <div
                        key={calendar.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-product-meta"
                      >
                        <span className="min-w-0 truncate text-text-secondary">
                          {calendar.name}
                        </span>
                        <button
                          type="button"
                          disabled={managingBusy}
                          onClick={() => {
                            setManagingBusy(true)
                            void restoreCalendarAction({
                              calendarId: calendar.id,
                            }).then((result) => {
                              setManagingBusy(false)
                              if (!result.ok) {
                                toast(result.error, { tone: "error" })
                                return
                              }
                              window.location.reload()
                            })
                          }}
                          className="font-medium text-ink disabled:opacity-45"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreatedCalendarId(null)
                  setManaging(false)
                  setCreating((current) => !current)
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-2 text-product-meta font-medium text-ink outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                New calendar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  setManaging((current) => !current)
                  if (!managing) {
                    void listTrashedCalendarsAction().then((result) => {
                      if (result.ok) setTrashedCalendars(result.data)
                      else toast(result.error, { tone: "error" })
                    })
                  }
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-2 text-product-meta text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <Settings2 aria-hidden="true" className="size-3.5" />
                Manage calendars
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
