process.env.TZ = "America/New_York"

import assert from "node:assert/strict"
import test from "node:test"
import {
  applyCaptureToForm,
  applyFormPatch,
  buildEventFormState,
  eventFormStatesEqual,
  formatEventFormDuration,
  resolveEventFormTimes,
  weeklyRruleForDate,
} from "./event-form-state.ts"

function form(overrides = {}) {
  return {
    title: "Design review",
    calendarId: "cal-1",
    startsDate: "2026-07-23",
    startsTime: "15:00",
    endsDate: "2026-07-23",
    endsTime: "16:00",
    timezone: "America/New_York",
    rrule: null,
    location: "",
    description: "",
    ...overrides,
  }
}

test("buildEventFormState seeds create mode from the clicked slot", () => {
  const state = buildEventFormState({
    mode: "create",
    initialRange: {
      startsAt: new Date(2026, 6, 23, 15, 0).toISOString(),
      endsAt: new Date(2026, 6, 23, 17, 0).toISOString(),
    },
    defaultCalendarId: "cal-1",
  })

  assert.equal(state.title, "")
  assert.equal(state.calendarId, "cal-1")
  assert.equal(state.startsDate, "2026-07-23")
  assert.equal(state.startsTime, "15:00")
  assert.equal(state.endsTime, "17:00")
  assert.equal(state.rrule, null)
  assert.equal(state.timezone, "America/New_York")
})

test("buildEventFormState seeds edit mode from the event row", () => {
  const state = buildEventFormState({
    mode: "edit",
    event: {
      id: "event-1",
      calendar_id: "cal-9",
      title: "Standup",
      starts_at: new Date(2026, 6, 23, 9, 30).toISOString(),
      ends_at: new Date(2026, 6, 23, 9, 45).toISOString(),
      location: "Studio",
      timezone: "America/New_York",
      rrule: "FREQ=WEEKLY;BYDAY=TH",
      description_json: { text: "Bring notes" },
    },
    defaultCalendarId: "cal-1",
  })

  assert.equal(state.title, "Standup")
  assert.equal(state.calendarId, "cal-9")
  assert.equal(state.startsTime, "09:30")
  assert.equal(state.endsTime, "09:45")
  assert.equal(state.location, "Studio")
  assert.equal(state.rrule, "FREQ=WEEKLY;BYDAY=TH")
  assert.equal(state.timezone, "America/New_York")
  assert.equal(state.description, "Bring notes")
})

test("buildEventFormState tolerates an event with no description text", () => {
  const state = buildEventFormState({
    mode: "edit",
    event: {
      id: "event-1",
      calendar_id: "cal-9",
      title: "Standup",
      starts_at: new Date(2026, 6, 23, 9, 30).toISOString(),
      ends_at: new Date(2026, 6, 23, 9, 45).toISOString(),
      location: null,
      description_json: {},
    },
    defaultCalendarId: "cal-1",
  })

  assert.equal(state.description, "")
  assert.equal(state.location, "")
})

test("resolveEventFormTimes returns timestamps and a duration for a valid form", () => {
  const times = resolveEventFormTimes(form())

  assert.equal(times.ok, true)
  assert.equal(times.durationMinutes, 60)
  assert.equal(times.startsAt, new Date(2026, 6, 23, 15, 0).toISOString())
  assert.equal(times.startsAtLocal, "2026-07-23T15:00:00")
  assert.equal(times.endsAtLocal, "2026-07-23T16:00:00")
  assert.equal(times.timezone, "America/New_York")
})

test("resolveEventFormTimes reports a cleared field instead of throwing", () => {
  // A cleared native input used to reach new Date("").toISOString() and crash.
  const times = resolveEventFormTimes(form({ endsTime: "" }))

  assert.equal(times.ok, false)
  assert.equal(times.error, "Add a start and end time before saving.")
})

test("resolveEventFormTimes rejects an end at or before the start", () => {
  for (const endsTime of ["15:00", "14:00"]) {
    const times = resolveEventFormTimes(form({ endsTime }))
    assert.equal(times.ok, false)
    assert.equal(times.error, "The event must end after it starts.")
  }
})

test("formatEventFormDuration reads as a human duration and nulls out when invalid", () => {
  assert.equal(formatEventFormDuration(form()), "1 hour")
  assert.equal(formatEventFormDuration(form({ endsTime: "15:30" })), "30 minutes")
  assert.equal(formatEventFormDuration(form({ endsTime: "17:30" })), "2h 30m")
  assert.equal(formatEventFormDuration(form({ endsTime: "17:00" })), "2 hours")
  assert.equal(formatEventFormDuration(form({ endsTime: "" })), null)
})

test("applyCaptureToForm writes the parsed title and times into the form", () => {
  const capture = {
    title: "Sync",
    startsAt: new Date(2026, 6, 24, 11, 0).toISOString(),
    endsAt: new Date(2026, 6, 24, 11, 30).toISOString(),
    consumedRanges: [],
    dateSource: "parsed",
    timeSource: "parsed",
    durationMinutes: 30,
    rrule: "FREQ=WEEKLY;BYDAY=FR",
  }

  const next = applyCaptureToForm(form({ location: "Studio" }), capture)

  assert.equal(next.title, "Sync")
  assert.equal(next.startsDate, "2026-07-24")
  assert.equal(next.startsTime, "11:00")
  assert.equal(next.endsTime, "11:30")
  assert.equal(next.rrule, "FREQ=WEEKLY;BYDAY=FR")
  // Fields quick capture does not speak for are left alone.
  assert.equal(next.location, "Studio")
  assert.equal(next.calendarId, "cal-1")
})

test("applyFormPatch drags the end date along when the start date moves", () => {
  const next = applyFormPatch(
    form({ rrule: "FREQ=WEEKLY;BYDAY=TH" }),
    { startsDate: "2026-07-25" },
  )

  assert.equal(next.startsDate, "2026-07-25")
  assert.equal(next.endsDate, "2026-07-25")
  assert.equal(next.rrule, "FREQ=WEEKLY;BYDAY=SA")
})

test("weeklyRruleForDate maps the authored local day without UTC drift", () => {
  assert.equal(weeklyRruleForDate("2026-07-23"), "FREQ=WEEKLY;BYDAY=TH")
  assert.equal(weeklyRruleForDate("not-a-date"), "FREQ=WEEKLY")
})

test("applyFormPatch preserves a multi-day span when the start date moves", () => {
  const twoDay = form({ endsDate: "2026-07-25" })
  const next = applyFormPatch(twoDay, { startsDate: "2026-07-24" })

  assert.equal(next.endsDate, "2026-07-26")
})

test("applyFormPatch leaves the end date alone for any other field", () => {
  const next = applyFormPatch(form(), { title: "Renamed" })

  assert.equal(next.title, "Renamed")
  assert.equal(next.endsDate, "2026-07-23")
})

test("eventFormStatesEqual compares every field", () => {
  assert.equal(eventFormStatesEqual(form(), form()), true)
  assert.equal(eventFormStatesEqual(form(), form({ title: "Other" })), false)
  assert.equal(eventFormStatesEqual(form(), form({ endsTime: "18:00" })), false)
})
