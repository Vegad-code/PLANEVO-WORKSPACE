import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuickCapture } from "./natural-capture.ts";
import { quickCaptureToTaskInsert } from "./quick-capture-to-task.ts";

/** Minimal QuickCaptureDraft with everything null; override per test. */
function draft(overrides = {}) {
  return {
    title: "Task",
    dueDate: null,
    priority: null,
    status: null,
    time: null,
    databaseToken: null,
    personToken: null,
    priorityToken: null,
    recurringUnsupported: false,
    consumedRanges: [],
    ...overrides,
  };
}

test("maps priority token to db enum, default status not_started", () => {
  const payload = quickCaptureToTaskInsert(
    draft({ title: "Finish essay", priority: "High", priorityToken: "high" }),
  );
  assert.equal(payload.title, "Finish essay");
  assert.equal(payload.priority, "high");
  assert.equal(payload.status, "not_started");
  assert.equal(payload.due_at, null);
});

test("no priority token maps to null priority", () => {
  const payload = quickCaptureToTaskInsert(draft());
  assert.equal(payload.priority, null);
});

test("status label maps back to db enum", () => {
  assert.equal(quickCaptureToTaskInsert(draft({ status: "Done" })).status, "done");
  assert.equal(
    quickCaptureToTaskInsert(draft({ status: "In progress" })).status,
    "in_progress",
  );
  assert.equal(
    quickCaptureToTaskInsert(draft({ status: "Not started" })).status,
    "not_started",
  );
});

test("date without time keeps the parser's start-of-day ISO unchanged", () => {
  const dueDate = new Date(2026, 6, 20).toISOString(); // local midnight Jul 20
  const payload = quickCaptureToTaskInsert(draft({ dueDate }));
  assert.equal(payload.due_at, dueDate);
});

test("date + time stamps local wall-clock time onto the due day", () => {
  const dueDate = new Date(2026, 6, 20).toISOString();
  const payload = quickCaptureToTaskInsert(
    draft({ dueDate, time: { hour: 15, minute: 30 } }),
  );
  // TZ-independent: same local Y/M/D at 15:30 local.
  assert.equal(payload.due_at, new Date(2026, 6, 20, 15, 30, 0, 0).toISOString());
});

test("time without a date is dropped (no fabricated day)", () => {
  const payload = quickCaptureToTaskInsert(draft({ time: { hour: 9, minute: 0 } }));
  assert.equal(payload.due_at, null);
});

test("end to end: parseQuickCapture -> insert payload", () => {
  const payload = quickCaptureToTaskInsert(parseQuickCapture("Finish essay !high"));
  assert.equal(payload.title, "Finish essay");
  assert.equal(payload.priority, "high");
  assert.equal(payload.status, "not_started");
  assert.equal(payload.due_at, null);
});
