import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CALENDAR_PALETTE,
  calendarEventSurface,
  contrastTextForCalendarColor,
  DEFAULT_CALENDAR_COLOR,
  normalizeCalendarColor,
} from "./calendar-color.ts"

test("calendar palette provides sixteen named product colors", () => {
  assert.equal(CALENDAR_PALETTE.length, 16)
  assert.equal(new Set(CALENDAR_PALETTE.map(({ key }) => key)).size, 16)
})

test("system default calendar color is blueberry", () => {
  assert.equal(DEFAULT_CALENDAR_COLOR, "blueberry")
  assert.notEqual(DEFAULT_CALENDAR_COLOR, "graphite")
  assert.ok(CALENDAR_PALETTE.some(({ key }) => key === DEFAULT_CALENDAR_COLOR))
  assert.equal(
    `--color-calendar-${DEFAULT_CALENDAR_COLOR}`,
    "--color-calendar-blueberry",
  )
})

test("palette keys and normalized custom hex values are accepted", () => {
  assert.equal(normalizeCalendarColor("sky"), "sky")
  assert.equal(normalizeCalendarColor("#aBc123"), "#ABC123")
})

test("invalid custom colors are rejected", () => {
  assert.equal(normalizeCalendarColor("#fff"), null)
  assert.equal(normalizeCalendarColor("#GGGGGG"), null)
  assert.equal(normalizeCalendarColor("not-a-color"), null)
})

test("event text selection preserves contrast on light and dark custom colors", () => {
  assert.equal(contrastTextForCalendarColor("#FFFFFF"), "ink")
  assert.equal(contrastTextForCalendarColor("#000000"), "paper")
})

test("event text selection keeps palette blocks readable", () => {
  assert.equal(contrastTextForCalendarColor("banana"), "ink")
  assert.equal(contrastTextForCalendarColor("flamingo"), "ink")
  assert.equal(contrastTextForCalendarColor("lavender"), "ink")
  assert.equal(contrastTextForCalendarColor("sage"), "ink")
  assert.equal(contrastTextForCalendarColor("sky"), "ink")
  assert.equal(contrastTextForCalendarColor("grape"), "paper")
  assert.equal(contrastTextForCalendarColor("blueberry"), "paper")
})

test("event surface stays solid accent — never a paper-washed fill", () => {
  const blueberry = calendarEventSurface("blueberry")
  assert.equal(blueberry.accent, "var(--color-calendar-blueberry)")
  assert.equal(blueberry.text, "paper")
  assert.equal(blueberry.accent.includes("color-mix"), false)

  const banana = calendarEventSurface("banana")
  assert.equal(banana.accent, "var(--color-calendar-banana)")
  assert.equal(banana.text, "ink")

  const custom = calendarEventSurface("#4454B4")
  assert.equal(custom.accent, "#4454B4")
  assert.equal(custom.text, "paper")
})
