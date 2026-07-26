import assert from "node:assert/strict";
import test from "node:test";
import { timelineAxis, timelineAxisSlots } from "./timeline-axis.ts";

const day = new Date(2026, 6, 14);
const at = (hour, minute = 0) => new Date(2026, 6, 14, hour, minute);
const event = (startHour, endHour, overrides = {}) => ({
  kind: "event",
  allDay: false,
  start: at(startHour),
  end: at(endHour),
  ...overrides,
});

test("fixed mode spans the complete local day", () => {
  const axis = timelineAxis({
    day,
    items: [event(9, 10)],
    mode: "fixed-24h",
  });

  assert.ok(axis);
  assert.deepEqual(
    [axis.start.getHours(), axis.end.getHours(), axis.end.getDate()],
    [0, 0, 15],
  );
});

test("cropped mode pads the first and last timed item by one slot", () => {
  const axis = timelineAxis({
    day,
    items: [event(9, 11), event(14, 15)],
    mode: "cropped-working-hours",
  });

  assert.ok(axis);
  assert.deepEqual(
    [axis.start.getHours(), axis.start.getMinutes()],
    [8, 30],
  );
  assert.deepEqual([axis.end.getHours(), axis.end.getMinutes()], [15, 30]);
});

test("auto-scale mode fits timed content exactly and ignores all-day rows", () => {
  const axis = timelineAxis({
    day,
    items: [
      event(0, 23, { allDay: true }),
      event(9, 11, { start: at(9, 15), end: at(10, 10) }),
    ],
    mode: "auto-scale-to-content",
  });

  assert.ok(axis);
  assert.deepEqual(
    [axis.start.getHours(), axis.start.getMinutes()],
    [9, 15],
  );
  assert.deepEqual([axis.end.getHours(), axis.end.getMinutes()], [10, 10]);
});

test("empty and all-day-only timelines retain a usable day axis", () => {
  const empty = timelineAxis({
    day,
    items: [],
    mode: "cropped-working-hours",
  });
  const allDay = timelineAxis({
    day,
    items: [event(0, 23, { allDay: true })],
    mode: "auto-scale-to-content",
  });

  assert.ok(empty);
  assert.ok(allDay);
  assert.equal(empty.start.getHours(), 0);
  assert.equal(allDay.start.getHours(), 0);
});

test("slot generation caps the last half-hour at an exact content boundary", () => {
  const axis = timelineAxis({
    day,
    items: [event(9, 11, { start: at(9, 15), end: at(10, 10) })],
    mode: "auto-scale-to-content",
  });

  assert.ok(axis);
  const slots = timelineAxisSlots(axis);
  assert.equal(slots.length, 2);
  assert.deepEqual(
    [slots[1].start.getHours(), slots[1].start.getMinutes()],
    [9, 45],
  );
  assert.equal(slots[1].end.getTime(), at(10, 10).getTime());
});

test("invalid days fail closed", () => {
  assert.equal(
    timelineAxis({
      day: new Date("invalid"),
      items: [],
      mode: "fixed-24h",
    }),
    null,
  );
});
