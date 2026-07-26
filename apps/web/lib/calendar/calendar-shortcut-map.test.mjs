import assert from "node:assert/strict"
import test from "node:test"
import {
  CALENDAR_HOTKEY_SCOPE,
  CALENDAR_P0_SHORTCUTS,
  createEventSlotFromNow,
  resolveCalendarShortcut,
} from "./calendar-shortcut-map.ts"

test("P0 map lists expected keys once each", () => {
  const keys = CALENDAR_P0_SHORTCUTS.map((entry) => entry.key)
  assert.deepEqual(keys.sort(), ["/", "?", "c", "d", "escape", "m", "t", "w"].sort())
  assert.equal(new Set(keys).size, keys.length)
})

test("letter keys route to create / today / views", () => {
  assert.deepEqual(resolveCalendarShortcut("c"), { type: "create-event" })
  assert.deepEqual(resolveCalendarShortcut("C"), { type: "create-event" })
  assert.deepEqual(resolveCalendarShortcut("t"), { type: "go-today" })
  assert.deepEqual(resolveCalendarShortcut("d"), {
    type: "switch-view",
    view: "day",
  })
  assert.deepEqual(resolveCalendarShortcut("w"), {
    type: "switch-view",
    view: "week",
  })
  assert.deepEqual(resolveCalendarShortcut("m"), {
    type: "switch-view",
    view: "month",
  })
})

test("help search and dismiss keys route correctly", () => {
  assert.deepEqual(resolveCalendarShortcut("?"), { type: "open-cheat-sheet" })
  assert.deepEqual(resolveCalendarShortcut("/"), { type: "focus-search" })
  assert.deepEqual(resolveCalendarShortcut("Escape"), { type: "dismiss" })
  assert.deepEqual(resolveCalendarShortcut("Esc"), { type: "dismiss" })
})

test("out-of-scope and navigation keys do not resolve", () => {
  assert.equal(resolveCalendarShortcut("j"), null)
  assert.equal(resolveCalendarShortcut("k"), null)
  assert.equal(resolveCalendarShortcut("g"), null)
  assert.equal(resolveCalendarShortcut("ArrowLeft"), null)
  assert.equal(resolveCalendarShortcut("Enter"), null)
  assert.equal(resolveCalendarShortcut("PageDown"), null)
  assert.equal(resolveCalendarShortcut(""), null)
})

test("hotkey scope constant is stable for calendar route", () => {
  assert.equal(CALENDAR_HOTKEY_SCOPE, "calendar-global")
})

test("createEventSlotFromNow rounds up to the next half hour", () => {
  const slot = createEventSlotFromNow(new Date(2026, 6, 24, 14, 17, 42))
  assert.equal(slot.getHours(), 14)
  assert.equal(slot.getMinutes(), 30)
  assert.equal(slot.getSeconds(), 0)
})

test("createEventSlotFromNow rolls to the next hour at :00 past half", () => {
  const slot = createEventSlotFromNow(new Date(2026, 6, 24, 14, 45, 0))
  assert.equal(slot.getHours(), 15)
  assert.equal(slot.getMinutes(), 0)
})
