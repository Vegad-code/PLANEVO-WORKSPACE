import assert from "node:assert/strict"
import test from "node:test"
import {
  eventToMonthItem,
  getMonthEventDisplayStyle,
  monthItemsForCalendarDay,
  sortMonthItems,
  taskDueToMonthItem,
  toMonthItems,
} from "./month-items.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    calendar_id: "calendar-visible",
    user_id: "user-1",
    title: "Planning",
    starts_at: "2026-07-14T10:00:00.000Z",
    ends_at: "2026-07-14T11:00:00.000Z",
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

const calendars = [
  {
    id: "calendar-visible",
    user_id: "user-1",
    name: "Work",
    color: "ocean",
    is_visible: true,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "calendar-hidden",
    user_id: "user-1",
    name: "Hidden",
    color: "brick",
    is_visible: false,
    position: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
]

test("classifies timed single-day events and all-day or multi-day events", () => {
  assert.equal(getMonthEventDisplayStyle(event()), "timed")
  assert.equal(getMonthEventDisplayStyle(event({ all_day: true })), "bar")
  assert.equal(
    getMonthEventDisplayStyle(
      event({ ends_at: "2026-07-15T10:00:00.000Z" }),
    ),
    "bar",
  )
})

test("treats all-day ends as exclusive for day overlap", () => {
  const allDay = event({
    all_day: true,
    starts_at: "2026-07-14T00:00:00.000Z",
    ends_at: "2026-07-15T00:00:00.000Z",
  })
  const item = eventToMonthItem(allDay, "ocean")

  assert.equal(monthItemsForCalendarDay([item], new Date(2026, 6, 14)).length, 1)
  assert.equal(monthItemsForCalendarDay([item], new Date(2026, 6, 15)).length, 0)
})

test("converts task dues with completion and toggle metadata", () => {
  const openTask = taskDueToMonthItem({
    taskId: "task-open",
    title: "Send notes",
    dueAt: "2026-07-14T14:00:00.000Z",
    status: "in_progress",
  })
  const completedTask = taskDueToMonthItem({
    taskId: "task-done",
    title: "Archive notes",
    dueAt: "2026-07-14T15:00:00.000Z",
    status: "done",
  })

  assert.equal(openTask.displayStyle, "task")
  assert.equal(openTask.completed, false)
  assert.deepEqual(openTask.toggle, { taskId: "task-open", nextCompleted: true })
  assert.equal(completedTask.completed, true)
  assert.deepEqual(completedTask.toggle, { taskId: "task-done", nextCompleted: false })
})

test("filters hidden calendars and preserves color plus synced-source metadata", () => {
  const visibleSubscription = event({
    id: "ics-event",
    source: "ics",
  })
  const hidden = event({ id: "hidden-event", calendar_id: "calendar-hidden" })
  const items = toMonthItems([visibleSubscription, hidden], [], calendars)

  assert.equal(items.length, 1)
  assert.equal(items[0].kind, "event")
  assert.equal(items[0].calendarColor, "ocean")
  assert.equal(items[0].isSyncedSource, true)
  assert.equal(items[0].source, "ics")
})

test("task blocks use the task's current title", () => {
  const item = eventToMonthItem(
    event({
      task_id: "task-1",
      linked_task: {
        id: "task-1",
        title: "Current task title",
        status: "not_started",
        estimateMinutes: 45,
      },
    }),
    "ocean",
  )

  assert.equal(item.title, "Current task title")
})

test("toMonthItems suppresses due chips when a scheduled block exists", () => {
  const scheduled = event({
    id: "block-1",
    task_id: "task-1",
    title: "Scheduled block",
    starts_at: "2026-07-14T10:00:00.000Z",
    ends_at: "2026-07-14T11:00:00.000Z",
    linked_task: {
      id: "task-1",
      title: "Scheduled block",
      status: "not_started",
      estimateMinutes: null,
    },
  })
  const items = toMonthItems(
    [scheduled],
    [
      {
        taskId: "task-1",
        title: "Scheduled block",
        dueAt: "2026-07-14T16:00:00.000Z",
        status: "not_started",
      },
      {
        taskId: "task-2",
        title: "Due only",
        dueAt: "2026-07-14T16:00:00.000Z",
        status: "not_started",
      },
    ],
    calendars,
  )

  assert.equal(items.length, 2)
  assert.ok(items.some((item) => item.kind === "event"))
  assert.ok(items.some((item) => item.kind === "task" && item.taskId === "task-2"))
  assert.ok(!items.some((item) => item.kind === "task" && item.taskId === "task-1"))
})

test("sorts bars, open task dues, timed events, then completed task dues", () => {
  const items = [
    taskDueToMonthItem({ taskId: "done", title: "Done", dueAt: "2026-07-14T08:00:00.000Z", status: "done" }),
    eventToMonthItem(event({ id: "timed", title: "Timed", starts_at: "2026-07-14T11:00:00.000Z", ends_at: "2026-07-14T12:00:00.000Z" }), "ocean"),
    taskDueToMonthItem({ taskId: "open", title: "Open", dueAt: "2026-07-14T09:00:00.000Z", status: "not_started" }),
    eventToMonthItem(event({ id: "bar", title: "Bar", all_day: true, starts_at: "2026-07-14T00:00:00.000Z", ends_at: "2026-07-15T00:00:00.000Z" }), "ocean"),
  ]

  assert.deepEqual(sortMonthItems(items).map((item) => item.title), [
    "Bar",
    "Open",
    "Timed",
    "Done",
  ])
})

test("returns every item overlapping a local day for agendas and overflow", () => {
  const spanning = eventToMonthItem(
    event({
      id: "spanning",
      starts_at: "2026-07-13T10:00:00.000Z",
      ends_at: "2026-07-15T10:00:00.000Z",
    }),
    "ocean",
  )
  const due = taskDueToMonthItem({
    taskId: "today-task",
    title: "Due today",
    dueAt: "2026-07-14T16:00:00.000Z",
    status: "not_started",
  })

  assert.deepEqual(
    monthItemsForCalendarDay([spanning, due], new Date(2026, 6, 14)).map(
      (item) => item.id,
    ),
    ["event:spanning", "task:today-task"],
  )
})
