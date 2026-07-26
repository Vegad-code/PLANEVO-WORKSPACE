import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DRAFT_CREATE_EVENT_ID,
  DRAFT_CREATE_PLACEHOLDER_TITLE,
  isDraftCreateEvent,
  toDraftRbcEvent,
} from "./rbc-event-adapter.ts"

test("toDraftRbcEvent maps draft fields with placeholder title when empty", () => {
  const draft = toDraftRbcEvent({
    startsAt: "2026-07-22T14:00:00.000Z",
    endsAt: "2026-07-22T15:00:00.000Z",
    title: "",
    calendarId: "cal-1",
    color: "ocean",
  })

  assert.equal(draft.id, DRAFT_CREATE_EVENT_ID)
  assert.equal(draft.planevoEventId, DRAFT_CREATE_EVENT_ID)
  assert.equal(draft.title, DRAFT_CREATE_PLACEHOLDER_TITLE)
  assert.equal(draft.isDraft, true)
  assert.equal(draft.color, "ocean")
  assert.equal(draft.start.toISOString(), "2026-07-22T14:00:00.000Z")
  assert.equal(draft.end.toISOString(), "2026-07-22T15:00:00.000Z")
})

test("toDraftRbcEvent preserves non-empty title", () => {
  const draft = toDraftRbcEvent({
    startsAt: "2026-07-22T14:00:00.000Z",
    endsAt: "2026-07-22T15:00:00.000Z",
    title: "  Team sync  ",
    calendarId: "cal-1",
    color: "meadow",
  })

  assert.equal(draft.title, "Team sync")
})

test("isDraftCreateEvent identifies draft sentinel", () => {
  const draft = toDraftRbcEvent({
    startsAt: "2026-07-22T14:00:00.000Z",
    endsAt: "2026-07-22T15:00:00.000Z",
    title: "",
    calendarId: "cal-1",
    color: "ocean",
  })

  assert.equal(isDraftCreateEvent(draft), true)
  assert.equal(
    isDraftCreateEvent({
      ...draft,
      isDraft: undefined,
      id: DRAFT_CREATE_EVENT_ID,
    }),
    true,
  )
  assert.equal(
    isDraftCreateEvent({
      ...draft,
      id: "evt-real",
      isDraft: false,
    }),
    false,
  )
})
