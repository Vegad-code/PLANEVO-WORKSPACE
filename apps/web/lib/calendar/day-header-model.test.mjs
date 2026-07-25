import assert from "node:assert/strict"
import test from "node:test"
import { formatMonthDateLabel } from "./day-header-model.ts"

test("formatMonthDateLabel shows short month on the 1st", () => {
  assert.equal(formatMonthDateLabel(new Date(2026, 4, 1)), "May 1")
  assert.equal(formatMonthDateLabel(new Date(2026, 5, 1)), "Jun 1")
})

test("formatMonthDateLabel shows day number only on other days", () => {
  assert.equal(formatMonthDateLabel(new Date(2026, 6, 24)), "24")
  assert.equal(formatMonthDateLabel(new Date(2026, 6, 15)), "15")
})
