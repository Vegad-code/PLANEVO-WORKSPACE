import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CALENDAR_PALETTE,
  contrastTextForCalendarColor,
  normalizeCalendarColor,
} from "./calendar-color.ts"

test("calendar palette provides sixteen named product colors", () => {
  assert.equal(CALENDAR_PALETTE.length, 16)
  assert.equal(new Set(CALENDAR_PALETTE.map(({ key }) => key)).size, 16)
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
