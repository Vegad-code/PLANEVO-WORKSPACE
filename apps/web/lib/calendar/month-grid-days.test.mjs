import assert from "node:assert/strict"
import { test } from "node:test"
import { monthGridDays } from "./month-grid-days.ts"

test("monthGridDays trims an empty sixth week", () => {
  const days = monthGridDays(new Date(2026, 6, 15))
  assert.equal(days.length, 35)
})

test("monthGridDays keeps six weeks when the last week has in-month days", () => {
  const days = monthGridDays(new Date(2026, 7, 15))
  assert.equal(days.length, 42)
})
