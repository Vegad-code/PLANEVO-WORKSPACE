import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildEventPanelSavePayload,
  resolveEventPanelDismiss,
} from "./event-panel-dismiss.ts"

function form(overrides = {}) {
  return {
    title: "Meeting with Joe",
    calendarId: "cal-1",
    startsDate: "2026-07-29",
    startsTime: "10:00",
    endsDate: "2026-07-29",
    endsTime: "11:00",
    timezone: "America/Vancouver",
    allDay: false,
    rrule: null,
    location: "Office",
    description: "Notes",
    ...overrides,
  }
}

function okTimes() {
  return {
    ok: true,
    startsAt: "2026-07-29T17:00:00.000Z",
    endsAt: "2026-07-29T18:00:00.000Z",
    startsAtLocal: "2026-07-29T10:00:00",
    endsAtLocal: "2026-07-29T11:00:00",
    timezone: "America/Vancouver",
    durationMinutes: 60,
    allDay: false,
  }
}

function saveInput(overrides = {}) {
  return {
    form: form(),
    selectedCalendarId: "cal-1",
    resolvedTimes: okTimes(),
    reminderOffsetMinutes: 10,
    eventColor: null,
    colorRequired: false,
    mutationBlocked: false,
    isPending: false,
    ...overrides,
  }
}

describe("buildEventPanelSavePayload", () => {
  it("builds a payload from a valid draft", () => {
    const payload = buildEventPanelSavePayload(saveInput())
    assert.ok(payload)
    assert.equal(payload.title, "Meeting with Joe")
    assert.equal(payload.calendarId, "cal-1")
    assert.equal(payload.location, "Office")
    assert.equal(payload.reminderOffsetMinutes, 10)
  })

  it("returns null when the title is blank", () => {
    assert.equal(
      buildEventPanelSavePayload(saveInput({ form: form({ title: "  " }) })),
      null,
    )
  })

  it("returns null when times do not resolve", () => {
    assert.equal(
      buildEventPanelSavePayload(
        saveInput({ resolvedTimes: { ok: false, error: "bad times" } }),
      ),
      null,
    )
  })

  it("returns null when a required event color is missing", () => {
    assert.equal(
      buildEventPanelSavePayload(
        saveInput({ colorRequired: true, eventColor: null }),
      ),
      null,
    )
  })

  it("returns null while a save is already pending", () => {
    assert.equal(buildEventPanelSavePayload(saveInput({ isPending: true })), null)
  })
})

describe("resolveEventPanelDismiss", () => {
  it("closes create drafts without saving", () => {
    assert.deepEqual(
      resolveEventPanelDismiss({
        mode: "create",
        isDirty: true,
        saveInput: saveInput(),
      }),
      { kind: "close" },
    )
  })

  it("closes clean edits without saving", () => {
    assert.deepEqual(
      resolveEventPanelDismiss({
        mode: "edit",
        isDirty: false,
        saveInput: saveInput(),
      }),
      { kind: "close" },
    )
  })

  it("silent-saves a dirty valid edit instead of confirming discard", () => {
    const decision = resolveEventPanelDismiss({
      mode: "edit",
      isDirty: true,
      saveInput: saveInput(),
    })
    assert.equal(decision.kind, "silent_save")
    if (decision.kind === "silent_save") {
      assert.equal(decision.payload.title, "Meeting with Joe")
    }
  })

  it("closes a dirty invalid edit without a confirm nag", () => {
    assert.deepEqual(
      resolveEventPanelDismiss({
        mode: "edit",
        isDirty: true,
        saveInput: saveInput({ form: form({ title: "" }) }),
      }),
      { kind: "close" },
    )
  })
})
