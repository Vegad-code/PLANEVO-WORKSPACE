import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPlanningWidth,
  DEFAULT_PLANNING_WIDTH,
  MAX_PLANNING_WIDTH,
  MIN_PLANNING_WIDTH,
} from "./planning-prefs.ts";

test("clampPlanningWidth clamps below min", () => {
  assert.equal(clampPlanningWidth(100), MIN_PLANNING_WIDTH);
});

test("clampPlanningWidth clamps above max", () => {
  assert.equal(clampPlanningWidth(999), MAX_PLANNING_WIDTH);
});

test("clampPlanningWidth rounds and keeps in-range values", () => {
  assert.equal(clampPlanningWidth(320.4), 320);
  assert.equal(clampPlanningWidth(DEFAULT_PLANNING_WIDTH), DEFAULT_PLANNING_WIDTH);
});
