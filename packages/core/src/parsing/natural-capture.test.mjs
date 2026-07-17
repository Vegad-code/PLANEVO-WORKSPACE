import assert from "node:assert/strict";
import test from "node:test";
import {
  parseNaturalCaptureLine,
  parseNaturalCaptureLines,
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
