import assert from "node:assert/strict";
import test from "node:test";
import {
  PLANNING_SECTION_IDS,
  togglePlanningSection,
} from "./planning-collapse.ts";

test("togglePlanningSection collapses an open section", () => {
  const next = togglePlanningSection(new Set(), "date");
  assert.deepEqual([...next], ["date"]);
});

test("togglePlanningSection expands a collapsed section", () => {
  const next = togglePlanningSection(new Set(["date", "tasks"]), "date");
  assert.deepEqual([...next], ["tasks"]);
});

test("planning section ids are the three accordion keys", () => {
  assert.deepEqual([...PLANNING_SECTION_IDS], ["date", "tasks", "calendars"]);
});
