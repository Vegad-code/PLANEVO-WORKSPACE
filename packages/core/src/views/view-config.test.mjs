import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_VIEW_CONFIG,
  OPERATORS_BY_TYPE,
  normalizeViewConfig,
  pruneViewConfig,
  updateViewConfig,
} from "./view-config.ts";

test("normalizeViewConfig tolerates empty object", () => {
  assert.deepEqual(normalizeViewConfig({}), EMPTY_VIEW_CONFIG);
});

test("normalizeViewConfig tolerates junk and missing keys", () => {
  assert.deepEqual(normalizeViewConfig(null), EMPTY_VIEW_CONFIG);
  assert.deepEqual(normalizeViewConfig(42), EMPTY_VIEW_CONFIG);
  assert.deepEqual(normalizeViewConfig("nope"), EMPTY_VIEW_CONFIG);
  const partial = normalizeViewConfig({ filters: "not-an-array", sorts: [{}] });
  assert.deepEqual(partial.filters, []);
  assert.deepEqual(partial.sorts, []);
});

test("normalizeViewConfig keeps valid filters and drops broken ones", () => {
  const config = normalizeViewConfig({
    filters: [
      { id: "a", property_id: "p1", operator: "is", value: "x" },
      { property_id: "p2", operator: "contains", value: null },
      { operator: "is" },
    ],
  });
  assert.equal(config.filters.length, 2);
  assert.equal(config.filters[1].id, "p2:contains");
});

test("normalizeViewConfig normalizes sort direction and widths", () => {
  const config = normalizeViewConfig({
    sorts: [{ property_id: "p1", direction: "desc" }, { property_id: "p2", direction: "weird" }],
    column_widths: { p1: 200, p2: "wide", p3: NaN },
  });
  assert.equal(config.sorts[0].direction, "desc");
  assert.equal(config.sorts[1].direction, "asc");
  assert.deepEqual(config.column_widths, { p1: 200 });
});

test("updateViewConfig merges a patch", () => {
  const next = updateViewConfig(EMPTY_VIEW_CONFIG, { group_by_property_id: "status" });
  assert.equal(next.group_by_property_id, "status");
  assert.deepEqual(next.filters, []);
});

test("pruneViewConfig removes references to deleted properties", () => {
  const config = normalizeViewConfig({
    filters: [
      { id: "a", property_id: "keep", operator: "is", value: 1 },
      { id: "b", property_id: "gone", operator: "is", value: 1 },
    ],
    sorts: [{ property_id: "gone", direction: "asc" }],
    group_by_property_id: "gone",
    visible_properties: ["keep", "gone"],
    column_widths: { keep: 100, gone: 100 },
    calendar_date_property_id: "keep",
  });
  const pruned = pruneViewConfig(config, new Set(["keep"]));
  assert.equal(pruned.filters.length, 1);
  assert.equal(pruned.sorts.length, 0);
  assert.equal(pruned.group_by_property_id, null);
  assert.deepEqual(pruned.visible_properties, ["keep"]);
  assert.deepEqual(pruned.column_widths, { keep: 100 });
  assert.equal(pruned.calendar_date_property_id, "keep");
});

test("OPERATORS_BY_TYPE covers every filterable type", () => {
  assert.ok(OPERATORS_BY_TYPE.text.includes("contains"));
  assert.ok(OPERATORS_BY_TYPE.date.includes("is_within"));
  assert.deepEqual(OPERATORS_BY_TYPE.checkbox, ["is"]);
  assert.ok(OPERATORS_BY_TYPE["multi-select"].includes("not_contains"));
});
