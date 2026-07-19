import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_COLORS } from "./calendar.ts";
import {
  addWeeks,
  parseWeekParam,
  weekParam,
  weekRange,
} from "../state/calendar-state.ts";

test("CALENDAR_COLORS includes token keys", () => {
  assert.ok(CALENDAR_COLORS.includes("slate"));
  assert.ok(CALENDAR_COLORS.includes("marigold"));
});

test("weekRange returns Mon-Sun inclusive bounds", () => {
  const anchor = new Date(2026, 6, 15); // Wed Jul 15 2026
  const { start, end } = weekRange(anchor);
  assert.equal(start.getDay(), 1);
  assert.equal(end.getTime() - start.getTime(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(weekParam(anchor), "2026-W29");
});

test("weekRange treats Sunday as the end of the prior week", () => {
  const sunday = new Date(2026, 6, 19);
  const { start } = weekRange(sunday);
  assert.equal(start.getDate(), 13);
  assert.equal(start.getMonth(), 6);
});

test("parseWeekParam round-trips weekParam", () => {
  const anchor = new Date(2026, 6, 15);
  const monday = parseWeekParam(weekParam(anchor));
  assert.ok(monday);
  assert.equal(monday.getTime(), weekRange(anchor).start.getTime());
  // Sunday-starting year (2023) exercises the one-week correction path.
  const early2023 = new Date(2023, 0, 10);
  const parsed = parseWeekParam(weekParam(early2023));
  assert.ok(parsed);
  assert.equal(parsed.getTime(), weekRange(early2023).start.getTime());
  assert.equal(parseWeekParam("garbage"), null);
  assert.equal(parseWeekParam(null), null);
});

test("addWeeks shifts by whole weeks", () => {
  const anchor = new Date(2026, 6, 15);
  assert.equal(addWeeks(anchor, 1).getDate(), 22);
  assert.equal(addWeeks(anchor, -1).getDate(), 8);
});
