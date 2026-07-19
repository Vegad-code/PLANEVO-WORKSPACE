import assert from "node:assert/strict";
import test from "node:test";
import {
  parseNaturalCaptureLine,
  parseNaturalCaptureLines,
  parseQuickCapture,
} from "./natural-capture.ts";

const REFERENCE = new Date("2026-07-16T15:00:00.000Z"); // Thursday

test("parses em dash due segment", () => {
  const result = parseNaturalCaptureLine(
    "Email Sarah about pricing — friday",
    REFERENCE,
  );
  assert.equal(result.title, "Email Sarah about pricing");
  assert.ok(result.dueDate);
  assert.equal(new Date(result.dueDate).getDay(), 5);
});

test("parses due keyword", () => {
  const result = parseNaturalCaptureLine("Buy milk due tomorrow", REFERENCE);
  assert.equal(result.title, "Buy milk");
  assert.equal(new Date(result.dueDate).getDate(), 17);
});

test("detects priority and status tokens", () => {
  const result = parseNaturalCaptureLine("Fix login bug p1 in progress", REFERENCE);
  assert.equal(result.title, "Fix login bug");
  assert.equal(result.priority, "High");
  assert.equal(result.status, "In progress");
});

test("parseNaturalCaptureLines skips empty lines", () => {
  const rows = parseNaturalCaptureLines(["  ", "Ship release", ""], REFERENCE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Ship release");
});

test("quick capture pulls date, time, db token, and priority", () => {
  const result = parseQuickCapture("Physics homework friday 6pm #seed !high", REFERENCE);
  assert.equal(result.title, "Physics homework");
  assert.ok(result.dueDate);
  assert.equal(new Date(result.dueDate).getDay(), 5);
  assert.deepEqual(result.time, { hour: 18, minute: 0 });
  assert.equal(result.databaseToken, "seed");
  assert.equal(result.priorityToken, "high");
  assert.equal(result.priority, "High");
  assert.ok(result.consumedRanges.length > 0);
});

test("quick capture handles tmrw and in N days", () => {
  const tmrw = parseQuickCapture("call mom tmrw", REFERENCE);
  assert.equal(tmrw.title, "call mom");
  assert.equal(new Date(tmrw.dueDate).getDate(), 17);

  const inDays = parseQuickCapture("review deck in 3 days", REFERENCE);
  assert.equal(inDays.title, "review deck");
  assert.equal(new Date(inDays.dueDate).getDate(), 19);
});

test("quick capture next weekday lands in the following week", () => {
  const result = parseQuickCapture("budget next friday", REFERENCE);
  assert.equal(new Date(result.dueDate).getDate(), 24);
  assert.equal(new Date(result.dueDate).getDay(), 5);
});

test("quick capture parses 24h time and person token", () => {
  const result = parseQuickCapture("@sarah standup 18:00", REFERENCE);
  assert.equal(result.personToken, "sarah");
  assert.deepEqual(result.time, { hour: 18, minute: 0 });
  assert.equal(result.title, "standup");
});

test("quick capture flags recurring without scheduling it", () => {
  const result = parseQuickCapture("water plants every monday", REFERENCE);
  assert.equal(result.recurringUnsupported, true);
  assert.equal(result.dueDate, null);
  assert.equal(result.title, "water plants");
});

test("quick capture !! means high, at noon means midday", () => {
  const result = parseQuickCapture("lunch at noon !!", REFERENCE);
  assert.equal(result.priorityToken, "high");
  assert.deepEqual(result.time, { hour: 12, minute: 0 });
  assert.equal(result.title, "lunch");
});
