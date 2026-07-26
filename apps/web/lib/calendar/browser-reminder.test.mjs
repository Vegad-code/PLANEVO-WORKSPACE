import assert from "node:assert/strict"
import test from "node:test"
import {
  browserReminderBody,
  deliverBrowserReminder,
  dueBrowserReminder,
} from "./browser-reminder.ts"

const candidate = {
  reminderId: "reminder-1",
  eventId: "event-1",
  title: "Planning",
  startsAt: "2026-07-26T12:15:00.000Z",
  offsetMinutes: 15,
  location: "Room 2",
}

test("returns a stable notification only inside the delivery window", () => {
  const due = dueBrowserReminder(candidate, {
    now: new Date("2026-07-26T12:00:00.000Z"),
  })
  const early = dueBrowserReminder(candidate, {
    now: new Date("2026-07-26T11:50:00.000Z"),
  })

  assert.ok(due)
  assert.equal(
    due.notificationKey,
    "reminder-1:2026-07-26T12:15:00.000Z",
  )
  assert.equal(early, null)
})

test("notification times are formatted in the browser's explicit timezone", () => {
  assert.equal(
    browserReminderBody(candidate, {
      locale: "en-US",
      timeZone: "America/Los_Angeles",
    }),
    "5:15 AM · Room 2",
  )
})

test("a failed notification is never remembered as delivered", () => {
  const due = dueBrowserReminder(candidate, {
    now: new Date("2026-07-26T12:00:00.000Z"),
  })
  assert.ok(due)
  const calls = []

  const delivered = deliverBrowserReminder(due, {
    notify: () => {
      calls.push("notify")
      throw new Error("browser rejected notification")
    },
    remember: () => calls.push("remember"),
  })

  assert.equal(delivered, false)
  assert.deepEqual(calls, ["notify"])
})

test("rejects invalid clocks and reminder offsets", () => {
  assert.equal(
    dueBrowserReminder(
      { ...candidate, offsetMinutes: -1 },
      { now: new Date("2026-07-26T12:00:00.000Z") },
    ),
    null,
  )
  assert.equal(
    dueBrowserReminder(candidate, { now: new Date("invalid") }),
    null,
  )
})
