import assert from "node:assert/strict"
import test from "node:test"
import { eventsForCalendarDay } from "./month-day-events.ts"

const spanning = {
  id: "e1",
  calendar_id: "c1",
  user_id: "u1",
  title: "Conference",
  starts_at: "2026-07-01T09:00:00.000Z",
  ends_at: "2026-07-05T17:00:00.000Z",
  all_day: false,
  location: null,
  description_json: {},
  task_id: null,
  google_event_id: null,
  source: "planevo",
  created_at: "",
  updated_at: "",
}

test("eventsForCalendarDay includes multi-day events active on that day", () => {
  const day = new Date(2026, 6, 3)
  const result = eventsForCalendarDay([spanning], day)
  assert.equal(result.length, 1)
  assert.equal(result[0].title, "Conference")
})

test("eventsForCalendarDay excludes events that ended before the day", () => {
  const day = new Date(2026, 6, 10)
  const result = eventsForCalendarDay([spanning], day)
  assert.equal(result.length, 0)
})
