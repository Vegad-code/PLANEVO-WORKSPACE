import assert from "node:assert/strict"
import test from "node:test"
import {
  embeddedCalendarRequest,
  parseCalendarEmbedTarget,
} from "./embedded-calendar.ts"

const now = new Date(2026, 6, 26, 15, 30)

test("embeds preserve Main and isolated canonical targets", () => {
  assert.deepEqual(
    parseCalendarEmbedTarget({ targetKind: "main" }),
    { kind: "main" },
  )
  assert.deepEqual(
    parseCalendarEmbedTarget({
      targetKind: "calendar",
      calendarId: "work",
    }),
    { kind: "calendar", calendarId: "work" },
  )
})

test("missing and unavailable targets never broaden to Main", () => {
  assert.equal(
    parseCalendarEmbedTarget({
      targetKind: "calendar",
      calendarId: "",
    }),
    null,
  )
  assert.equal(
    parseCalendarEmbedTarget({ targetKind: "unavailable" }),
    null,
  )
})

test("embed stores a local surface view and cannot use Year", () => {
  assert.deepEqual(
    embeddedCalendarRequest({
      target: { kind: "main" },
      view: "week",
      now,
    }),
    {
      context: { kind: "main" },
      date: "2026-07-26",
      view: "week",
    },
  )
  assert.equal(
    embeddedCalendarRequest({
      target: { kind: "main" },
      view: "year",
      now,
    }).view,
    "month",
  )
})
