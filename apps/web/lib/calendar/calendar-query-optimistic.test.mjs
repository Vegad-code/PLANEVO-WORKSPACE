import assert from "node:assert/strict"
import test from "node:test"
import {
  appendEvent,
  buildOptimisticEvent,
  patchEventFields,
  patchEventTimes,
  patchTaskDueDate,
  patchTaskStatus,
  removeEvent,
  removeTodayTask,
  replaceEventId,
} from "./calendar-query-optimistic.ts"

function payload() {
  return {
    scope: "all",
    anchorDate: "2026-07-14",
    view: "month",
    workspaceId: null,
    calendars: [{ id: "cal-1", name: "Personal", color: "ocean" }],
    events: [
      { id: "event-1", title: "Standup", starts_at: "A", ends_at: "B" },
      { id: "event-2", title: "Review", starts_at: "C", ends_at: "D" },
    ],
    taskDues: [
      { taskId: "task-1", title: "Ship it", dueAt: "X", status: "todo" },
      { taskId: "task-2", title: "Write docs", dueAt: "Y", status: "todo" },
    ],
    todayTasks: [],
  }
}

test("patches only the targeted event's times", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "event-1",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert
  assert.equal(after.events[0].starts_at, "NEW-START")
  assert.equal(after.events[0].endsAt, undefined)
  assert.equal(after.events[0].ends_at, "NEW-END")
  assert.equal(after.events[0].title, "Standup")
  assert.deepEqual(after.events[1], before.events[1])
})

test("leaves the original payload untouched when patching an event", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "event-1",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert — new payload, new array, original values intact.
  assert.notEqual(after, before)
  assert.notEqual(after.events, before.events)
  assert.equal(before.events[0].starts_at, "A")
})

test("patches only the targeted task's due date", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchTaskDueDate(before, { taskId: "task-2", dueAt: "NEW-DUE" })

  // Assert
  assert.equal(after.taskDues[1].dueAt, "NEW-DUE")
  assert.equal(after.taskDues[1].title, "Write docs")
  assert.deepEqual(after.taskDues[0], before.taskDues[0])
  assert.equal(before.taskDues[1].dueAt, "Y")
})

test("returns the payload unchanged for an unknown event id", () => {
  // Arrange — models a write landing after the cache was already invalidated.
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "missing",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert
  assert.equal(after, before)
})

test("returns the payload unchanged for an unknown task id", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchTaskDueDate(before, { taskId: "missing", dueAt: "NEW" })

  // Assert
  assert.equal(after, before)
})

test("removes only the targeted event", () => {
  const before = payload()
  const after = removeEvent(before, "event-1")
  assert.equal(after.events.length, 1)
  assert.equal(after.events[0].id, "event-2")
})

test("appends an optimistic event without mutating existing rows", () => {
  const before = payload()
  const optimistic = buildOptimisticEvent({
    tempId: "optimistic-event-1",
    userId: "user-1",
    payload: {
      calendarId: "cal-1",
      title: "New",
      startsAt: "S",
      endsAt: "E",
      startsAtLocal: "S",
      endsAtLocal: "E",
      timezone: "UTC",
      durationMinutes: 30,
      rrule: null,
      location: null,
      description: "",
      reminderOffsetMinutes: null,
      allDay: false,
    },
  })
  const after = appendEvent(before, optimistic)
  assert.equal(after.events.length, 3)
  assert.equal(after.events[2].id, "optimistic-event-1")
})

test("replaces a temporary event id with the server id", () => {
  const before = appendEvent(
    payload(),
    buildOptimisticEvent({
      tempId: "optimistic-event-1",
      userId: "user-1",
      payload: {
        calendarId: "cal-1",
        title: "New",
        startsAt: "S",
        endsAt: "E",
        startsAtLocal: "S",
        endsAtLocal: "E",
        timezone: "UTC",
        durationMinutes: 30,
        rrule: null,
        location: null,
        description: "",
        reminderOffsetMinutes: null,
      },
    }),
  )
  const after = replaceEventId(before, {
    tempId: "optimistic-event-1",
    serverId: "server-event-1",
  })
  assert.equal(after.events.at(-1).id, "server-event-1")
})

test("patches event fields from the panel save payload", () => {
  const before = payload()
  const after = patchEventFields(before, {
    eventId: "event-1",
    fields: {
      calendarId: "cal-1",
      title: "Renamed",
      startsAt: "NEW-S",
      endsAt: "NEW-E",
      startsAtLocal: "NEW-S",
      endsAtLocal: "NEW-E",
      timezone: "UTC",
      durationMinutes: 45,
      rrule: null,
      location: "Room A",
      description: "Notes",
      reminderOffsetMinutes: 10,
      allDay: false,
    },
  })
  assert.equal(after.events[0].title, "Renamed")
  assert.equal(after.events[0].location, "Room A")
})

test("patchEventTimes syncs task due chips for linked events", () => {
  const before = {
    ...payload(),
    events: [
      {
        ...payload().events[0],
        task_id: "task-1",
        linked_task: {
          id: "task-1",
          title: "Ship it",
          status: "not_started",
          estimateMinutes: null,
        },
      },
      payload().events[1],
    ],
  }
  const after = patchEventTimes(before, {
    eventId: "event-1",
    startsAt: "DUE-S",
    endsAt: "DUE-E",
  })
  assert.equal(after.taskDues[0].dueAt, "DUE-S")
  assert.equal(after.events[0].starts_at, "DUE-S")
})

test("patchEventFields syncs task due chips when linked block times change", () => {
  const before = {
    ...payload(),
    events: [
      {
        ...payload().events[0],
        task_id: "task-1",
        linked_task: {
          id: "task-1",
          title: "Ship it",
          status: "not_started",
          estimateMinutes: null,
        },
      },
      payload().events[1],
    ],
  }
  const after = patchEventFields(before, {
    eventId: "event-1",
    fields: {
      calendarId: "cal-1",
      title: "Ship it",
      startsAt: "DUE-S",
      endsAt: "DUE-E",
      startsAtLocal: "DUE-S",
      endsAtLocal: "DUE-E",
      timezone: "UTC",
      durationMinutes: 45,
      rrule: null,
      location: null,
      description: "",
      reminderOffsetMinutes: null,
      allDay: false,
    },
  })
  assert.equal(after.taskDues[0].dueAt, "DUE-S")
  assert.equal(after.events[0].linked_task.title, "Ship it")
})

test("patchTaskDueDate moves a linked block when requested", () => {
  const before = {
    ...payload(),
    events: [
      {
        ...payload().events[0],
        id: "event-linked",
        task_id: "task-1",
        starts_at: "2026-07-14T09:00:00.000Z",
        ends_at: "2026-07-14T10:00:00.000Z",
      },
      payload().events[1],
    ],
  }
  const after = patchTaskDueDate(before, {
    taskId: "task-1",
    dueAt: "2026-07-20T09:00:00.000Z",
    moveLinkedBlock: true,
  })
  assert.equal(after.taskDues[0].dueAt, "2026-07-20T09:00:00.000Z")
  assert.equal(after.events[0].starts_at, "2026-07-20T09:00:00.000Z")
  assert.equal(after.events[0].ends_at, "2026-07-20T10:00:00.000Z")
})

test("patchTaskDueDate leaves the block when only the due changes", () => {
  const before = {
    ...payload(),
    events: [
      {
        ...payload().events[0],
        id: "event-linked",
        task_id: "task-1",
        starts_at: "BLOCK-S",
        ends_at: "BLOCK-E",
      },
      payload().events[1],
    ],
  }
  const after = patchTaskDueDate(before, {
    taskId: "task-1",
    dueAt: "DUE-ONLY",
    moveLinkedBlock: false,
  })
  assert.equal(after.taskDues[0].dueAt, "DUE-ONLY")
  assert.equal(after.events[0].starts_at, "BLOCK-S")
})

test("updates task status across dues, today tasks, and linked events", () => {
  const before = {
    ...payload(),
    todayTasks: [
      { id: "task-1", title: "Ship it", status: "not_started", due_at: null },
    ],
    events: [
      {
        ...payload().events[0],
        task_id: "task-1",
        linked_task: {
          id: "task-1",
          title: "Ship it",
          status: "not_started",
          estimateMinutes: null,
        },
      },
      payload().events[1],
    ],
  }
  const after = patchTaskStatus(before, {
    taskId: "task-1",
    status: "done",
  })
  assert.equal(after.taskDues[0].status, "done")
  assert.equal(after.todayTasks[0].status, "done")
  assert.equal(after.events[0].linked_task.status, "done")
})

test("removes a scheduled task from the today column", () => {
  const before = {
    ...payload(),
    todayTasks: [
      { id: "task-1", title: "Ship it", status: "not_started", due_at: null },
    ],
  }
  const after = removeTodayTask(before, "task-1")
  assert.equal(after.todayTasks.length, 0)
})
