import assert from "node:assert/strict";
import test from "node:test";
import { applyView, compileFilter, compileSort } from "./filter-engine.ts";

const NOW = new Date(2026, 6, 16, 12, 0); // Thursday, local time (tz-robust)
// Local-midnight ISO strings so day-granularity comparisons never flip on tz.
const iso = (y, m, d) => new Date(y, m, d).toISOString();

const props = [
  { id: "name", type: "text", config_json: {} },
  { id: "est", type: "number", config_json: {} },
  { id: "due", type: "date", config_json: {} },
  { id: "status", type: "select", config_json: { options: [{ name: "To do" }, { name: "Doing" }, { name: "Done" }] } },
  { id: "tags", type: "multi-select", config_json: {} },
  { id: "done", type: "checkbox", config_json: {} },
];

function rec(id, values) {
  return { id, values };
}

const records = [
  rec("1", { name: "Alpha", est: 3, due: iso(2026, 6, 16), status: "Done", tags: ["a", "b"], done: true }),
  rec("2", { name: "Beta", est: 10, due: iso(2026, 6, 20), status: "To do", tags: ["b"], done: false }),
  rec("3", { name: "Gamma", est: null, due: null, status: "Doing", tags: [], done: false }),
];

test("text is / contains", () => {
  const p = compileFilter([{ id: "f", property_id: "name", operator: "contains", value: "ph" }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["1"]);
});

test("number comparisons", () => {
  const p = compileFilter([{ id: "f", property_id: "est", operator: "gte", value: 5 }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["2"]);
});

test("empty / not_empty", () => {
  const empty = compileFilter([{ id: "f", property_id: "due", operator: "is_empty", value: null }], props, NOW);
  assert.deepEqual(records.filter(empty).map((r) => r.id), ["3"]);
  const notEmpty = compileFilter([{ id: "f", property_id: "due", operator: "is_not_empty", value: null }], props, NOW);
  assert.deepEqual(records.filter(notEmpty).map((r) => r.id), ["1", "2"]);
});

test("date is_within today", () => {
  const p = compileFilter([{ id: "f", property_id: "due", operator: "is_within", value: "today" }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["1"]);
});

test("date is_within overdue", () => {
  const past = [rec("x", { due: iso(2026, 6, 10) }), rec("y", { due: iso(2026, 6, 16) })];
  const p = compileFilter([{ id: "f", property_id: "due", operator: "is_within", value: "overdue" }], props, NOW);
  assert.deepEqual(past.filter(p).map((r) => r.id), ["x"]);
});

test("date is_before at day granularity", () => {
  const p = compileFilter([{ id: "f", property_id: "due", operator: "is_before", value: iso(2026, 6, 18) }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["1"]);
});

test("multi-select contains", () => {
  const p = compileFilter([{ id: "f", property_id: "tags", operator: "contains", value: "a" }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["1"]);
});

test("checkbox is", () => {
  const p = compileFilter([{ id: "f", property_id: "done", operator: "is", value: true }], props, NOW);
  assert.deepEqual(records.filter(p).map((r) => r.id), ["1"]);
});

test("sort by select option order, empties last", () => {
  const cmp = compileSort([{ property_id: "status", direction: "asc" }], props);
  const ordered = [...records].sort(cmp).map((r) => r.id);
  assert.deepEqual(ordered, ["2", "3", "1"]); // To do, Doing, Done
});

test("sort number desc puts empty last", () => {
  const cmp = compileSort([{ property_id: "est", direction: "desc" }], props);
  const ordered = [...records].sort(cmp).map((r) => r.id);
  assert.deepEqual(ordered, ["2", "1", "3"]);
});

test("applyView filters then sorts", () => {
  const config = {
    filters: [{ id: "f", property_id: "done", operator: "is", value: false }],
    sorts: [{ property_id: "name", direction: "desc" }],
    group_by_property_id: null,
    visible_properties: null,
    column_widths: {},
    calendar_date_property_id: null,
    collapsed_groups: [],
  };
  assert.deepEqual(applyView(records, config, props, NOW).map((r) => r.id), ["3", "2"]);
});
