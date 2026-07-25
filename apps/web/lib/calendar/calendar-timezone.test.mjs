import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatGmtOffsetLabel,
  formatUtcOffsetLabel,
} from "./calendar-timezone.ts"

test("formatUtcOffsetLabel uses UTC with hours and minutes", () => {
  assert.equal(formatUtcOffsetLabel(new Date(), -420), "UTC-07:00")
})

test("formatGmtOffsetLabel uses compact GMT offset", () => {
  assert.equal(formatGmtOffsetLabel(new Date(), -420), "GMT-7")
})

test("formatUtcOffsetLabel handles positive offsets", () => {
  assert.equal(formatUtcOffsetLabel(new Date(), 330), "UTC+05:30")
})
