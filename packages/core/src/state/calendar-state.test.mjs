import assert from "node:assert/strict";
import test from "node:test";

const {
  addMonths,
  calendarDays,
  calendarRange,
  dateKey,
  groupByDay,
  monthParam,
  parseMonthParam,
} = await import("./calendar-state.ts");

test("month grid is 42 cells starting on a Sunday and covering the month", () => {
  const days = calendarDays(new Date(2026, 6, 1)); // July 2026
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 0);
  assert.ok(days.some((day) => dateKey(day) === "2026-07-01"));
  assert.ok(days.some((day) => dateKey(day) === "2026-07-31"));
});

test("calendarRange spans the full grid, end exclusive", () => {
  const { start, end } = calendarRange(new Date(2026, 6, 1));
  const days = calendarDays(new Date(2026, 6, 1));
  assert.equal(dateKey(start), dateKey(days[0]));
  const lastCell = days[days.length - 1];
  assert.ok(end.getTime() > lastCell.getTime());
  assert.equal((end.getTime() - start.getTime()) / 86_400_000, 42);
});

test("month param round trips and rejects malformed input", () => {
  const july = new Date(2026, 6, 1);
  assert.equal(monthParam(july), "2026-07");
  assert.equal(dateKey(parseMonthParam("2026-07")), "2026-07-01");
  assert.equal(parseMonthParam("2026-13"), null);
  assert.equal(parseMonthParam("garbage"), null);
  assert.equal(parseMonthParam(null), null);
});

test("addMonths handles year boundaries", () => {
  assert.equal(monthParam(addMonths(new Date(2026, 11, 1), 1)), "2027-01");
  assert.equal(monthParam(addMonths(new Date(2026, 0, 1), -1)), "2025-12");
});

test("groupByDay buckets by local day and skips invalid dates", () => {
  const grouped = groupByDay([
    { id: 1, date: "2026-07-04T10:00:00.000Z" },
    { id: 2, date: "2026-07-04T22:00:00.000Z" },
    { id: 3, date: "not-a-date" },
  ]);
  const total = [...grouped.values()].reduce((sum, items) => sum + items.length, 0);
  assert.equal(total, 2);
});
