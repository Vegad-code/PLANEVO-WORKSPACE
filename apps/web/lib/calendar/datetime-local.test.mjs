process.env.TZ = "America/New_York"

import assert from "node:assert/strict"
import test from "node:test"
import {
  fromDateAndTimeInputValues,
  fromDatetimeLocalValue,
  toDateInputValue,
  toDatetimeLocalValue,
  toTimeInputValue,
} from "./datetime-local.ts"

test("toDatetimeLocalValue renders an ISO timestamp in local wall-clock time", () => {
  assert.equal(
    toDatetimeLocalValue("2026-07-23T19:05:00.000Z"),
    "2026-07-23T15:05",
  )
})

test("toDateInputValue and toTimeInputValue split the same instant", () => {
  assert.equal(toDateInputValue("2026-07-23T19:05:00.000Z"), "2026-07-23")
  assert.equal(toTimeInputValue("2026-07-23T19:05:00.000Z"), "15:05")
})

test("the ISO-to-input converters return an empty string for unusable input", () => {
  assert.equal(toDatetimeLocalValue(""), "")
  assert.equal(toDatetimeLocalValue("not a date"), "")
  assert.equal(toDateInputValue(""), "")
  assert.equal(toTimeInputValue("not a date"), "")
})

test("fromDatetimeLocalValue round-trips a local value back to ISO", () => {
  assert.equal(
    fromDatetimeLocalValue("2026-07-23T15:05"),
    "2026-07-23T19:05:00.000Z",
  )
})

test("fromDatetimeLocalValue returns null for a cleared field instead of throwing", () => {
  // new Date("").toISOString() throws RangeError, which used to crash the panel.
  assert.equal(fromDatetimeLocalValue(""), null)
  assert.equal(fromDatetimeLocalValue("   "), null)
  assert.equal(fromDatetimeLocalValue("2026-13-45T99:99"), null)
})

test("fromDateAndTimeInputValues needs both halves before it resolves", () => {
  assert.equal(
    fromDateAndTimeInputValues("2026-07-23", "15:05"),
    "2026-07-23T19:05:00.000Z",
  )
  assert.equal(fromDateAndTimeInputValues("2026-07-23", ""), null)
  assert.equal(fromDateAndTimeInputValues("", "15:05"), null)
})
