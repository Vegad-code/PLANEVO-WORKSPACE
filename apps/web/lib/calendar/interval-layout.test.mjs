import assert from "node:assert/strict";
import test from "node:test";
import { layoutIntervals } from "./interval-layout.ts";

const at = (hour, minute = 0) => new Date(Date.UTC(2026, 6, 26, hour, minute));

const interval = (id, startHour, endHour, startMinute = 0, endMinute = 0) => ({
  id,
  start: at(startHour, startMinute),
  end: at(endHour, endMinute),
  title: `Event ${id}`,
});

const byId = (layout, id) => layout.find((item) => item.interval.id === id);

test("gives non-overlapping intervals the full width", () => {
  const layout = layoutIntervals({
    intervals: [interval("morning", 9, 10), interval("afternoon", 13, 14)],
  });

  assert.deepEqual(
    layout.map(({ interval: item, columnIndex, columnCount, left, width }) => ({
      id: item.id,
      columnIndex,
      columnCount,
      left,
      width,
    })),
    [
      {
        id: "morning",
        columnIndex: 0,
        columnCount: 1,
        left: 0,
        width: 1,
      },
      {
        id: "afternoon",
        columnIndex: 0,
        columnCount: 1,
        left: 0,
        width: 1,
      },
    ],
  );
});

test("splits two overlapping intervals into equal columns", () => {
  const layout = layoutIntervals({
    intervals: [interval("left", 9, 11), interval("right", 10, 12)],
  });

  assert.deepEqual(
    layout.map(({ interval: item, columnIndex, columnCount, left, width }) => ({
      id: item.id,
      columnIndex,
      columnCount,
      left,
      width,
    })),
    [
      { id: "left", columnIndex: 0, columnCount: 2, left: 0, width: 0.5 },
      {
        id: "right",
        columnIndex: 1,
        columnCount: 2,
        left: 0.5,
        width: 0.5,
      },
    ],
  );
});

test("tracks a three-way overlap across the whole collision cluster", () => {
  const layout = layoutIntervals({
    intervals: [
      interval("third", 10, 12),
      interval("first", 9, 13),
      interval("second", 9, 11, 30),
    ],
  });

  assert.deepEqual(
    layout.map(({ interval: item, columnIndex, columnCount }) => ({
      id: item.id,
      columnIndex,
      columnCount,
    })),
    [
      { id: "first", columnIndex: 0, columnCount: 3 },
      { id: "second", columnIndex: 1, columnCount: 3 },
      { id: "third", columnIndex: 2, columnCount: 3 },
    ],
  );
  assert.ok(layout.every((item) => item.width === 1 / 3));
});

test("reuses the first free column for sequential shorts overlapping a long event", () => {
  const layout = layoutIntervals({
    intervals: [
      interval("short-two", 10, 11),
      interval("long", 9, 12),
      interval("short-one", 9, 10),
    ],
  });

  assert.deepEqual(
    layout.map(({ interval: item, columnIndex, columnCount }) => ({
      id: item.id,
      columnIndex,
      columnCount,
    })),
    [
      { id: "long", columnIndex: 0, columnCount: 2 },
      { id: "short-one", columnIndex: 1, columnCount: 2 },
      { id: "short-two", columnIndex: 1, columnCount: 2 },
    ],
  );
});

test("treats zero-duration intervals as visible point slots", () => {
  const point = interval("point", 10, 10);
  const active = interval("active", 10, 11);

  const layout = layoutIntervals({ intervals: [point, active] });

  assert.equal(byId(layout, "active").columnIndex, 0);
  assert.equal(byId(layout, "point").columnIndex, 1);
  assert.equal(byId(layout, "point").columnCount, 2);
  assert.equal(byId(layout, "point").width, 0.5);
  assert.equal(point.end.getTime(), point.start.getTime());
});

test("uses independent maximum concurrency for each collision cluster", () => {
  const layout = layoutIntervals({
    intervals: [
      interval("early-a", 9, 11),
      interval("early-b", 10, 12),
      interval("late-a", 14, 17),
      interval("late-b", 15, 16),
      interval("late-c", 15, 16, 30),
    ],
  });

  assert.equal(byId(layout, "early-a").columnCount, 2);
  assert.equal(byId(layout, "early-b").columnCount, 2);
  assert.equal(byId(layout, "late-a").columnCount, 3);
  assert.equal(byId(layout, "late-b").columnCount, 3);
  assert.equal(byId(layout, "late-c").columnCount, 3);
});

test("sorts deterministically without mutating the caller's array or dates", () => {
  const later = interval("later", 11, 12);
  const shorter = interval("z-shorter", 9, 10);
  const longer = interval("a-longer", 9, 11);
  const intervals = [later, shorter, longer];
  const originalOrder = intervals.map((item) => item.id);
  const originalTimes = intervals.map((item) => [
    item.start.getTime(),
    item.end.getTime(),
  ]);

  const first = layoutIntervals({ intervals });
  const second = layoutIntervals({ intervals });

  assert.deepEqual(
    first.map((item) => item.interval.id),
    ["a-longer", "z-shorter", "later"],
  );
  assert.deepEqual(
    second.map((item) => item.interval.id),
    first.map((item) => item.interval.id),
  );
  assert.deepEqual(
    intervals.map((item) => item.id),
    originalOrder,
  );
  assert.deepEqual(
    intervals.map((item) => [item.start.getTime(), item.end.getTime()]),
    originalTimes,
  );
});

test("returns an empty layout for an empty interval list", () => {
  assert.deepEqual(layoutIntervals({ intervals: [] }), []);
});

test("rejects invalid dates, backward intervals, blank ids, and duplicate ids", () => {
  assert.throws(
    () =>
      layoutIntervals({
        intervals: [{ id: "not-a-date", start: "09:00", end: at(10) }],
      }),
    /not-a-date.*valid Date/i,
  );

  assert.throws(
    () =>
      layoutIntervals({
        intervals: [
          {
            id: "bad-date",
            start: new Date("invalid"),
            end: at(10),
          },
        ],
      }),
    /bad-date.*valid Date/i,
  );

  assert.throws(
    () =>
      layoutIntervals({
        intervals: [interval("backward", 11, 10)],
      }),
    /backward.*before its start/i,
  );

  assert.throws(
    () =>
      layoutIntervals({
        intervals: [{ id: " ", start: at(9), end: at(10) }],
      }),
    /non-empty id/i,
  );

  assert.throws(
    () =>
      layoutIntervals({
        intervals: [interval("same", 9, 10), interval("same", 11, 12)],
      }),
    /duplicate interval id.*same/i,
  );
});
