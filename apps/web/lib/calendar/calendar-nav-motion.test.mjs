import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarTransitionKey,
  calendarViewMotionVariants,
} from "./calendar-nav-motion.ts"

const anchor = new Date(2026, 6, 24)

test("calendarTransitionKey encodes view and anchor date", () => {
  assert.equal(calendarTransitionKey("week", anchor), "week-2026-07-24")
  assert.equal(calendarTransitionKey("day", anchor), "day-2026-07-24")
  assert.equal(calendarTransitionKey("year", anchor), "year-2026")
})

test("calendarViewMotionVariants uses horizontal slide for step intent", () => {
  const variants = calendarViewMotionVariants("step")
  assert.equal(variants.enter(1).x, 28)
  assert.equal(variants.exit(1).x, -28)
})

test("calendarViewMotionVariants uses fade-scale for view changes", () => {
  const variants = calendarViewMotionVariants("view")
  assert.equal(variants.enter.scale, 0.992)
  assert.equal(variants.center.opacity, 1)
})
