import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_TASKS_VIEW_PREFS,
  parseTasksViewPrefs,
} from "./task-view-prefs.ts"

test("parseTasksViewPrefs returns defaults for invalid input", () => {
  assert.deepEqual(parseTasksViewPrefs(null), DEFAULT_TASKS_VIEW_PREFS)
  assert.deepEqual(parseTasksViewPrefs("nope"), DEFAULT_TASKS_VIEW_PREFS)
})

test("parseTasksViewPrefs keeps valid fields and drops invalid ones", () => {
  const parsed = parseTasksViewPrefs({
    view: "table",
    grouping: "priority",
    sort: { key: "due", direction: "descending" },
    collapsedGroups: ["done", 12, "high"],
    hideDone: true,
    extra: true,
  })
  assert.deepEqual(parsed, {
    view: "table",
    grouping: "priority",
    sort: { key: "due", direction: "descending" },
    collapsedGroups: ["done", "high"],
    hideDone: true,
  })
})

test("parseTasksViewPrefs falls back invalid sort key", () => {
  const parsed = parseTasksViewPrefs({
    sort: { key: "bogus", direction: "ascending" },
  })
  assert.equal(parsed.sort.key, "title")
})
