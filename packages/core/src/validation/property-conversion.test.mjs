import assert from "node:assert/strict";
import test from "node:test";
import { planPropertyConversion } from "./property-conversion.ts";

test("text -> number keeps numerics, clears the rest", () => {
  const plan = planPropertyConversion("text", "number", {}, [
    { recordId: "a", value: "42" },
    { recordId: "b", value: "3.5" },
    { recordId: "c", value: "hello" },
    { recordId: "d", value: "" },
  ]);
  assert.deepEqual(plan.updates, [
    { record_id: "a", value: 42 },
    { record_id: "b", value: 3.5 },
  ]);
  assert.deepEqual(plan.clearRecordIds, ["c"]);
  assert.equal(plan.summary, "1 values can't be converted and will be cleared.");
});

test("number -> text stringifies", () => {
  const plan = planPropertyConversion("number", "text", {}, [{ recordId: "a", value: 7 }]);
  assert.deepEqual(plan.updates, [{ record_id: "a", value: "7" }]);
  assert.equal(plan.summary, "All 1 values convert cleanly.");
});

test("text -> select builds options from distinct values", () => {
  const plan = planPropertyConversion("text", "select", { role: "status" }, [
    { recordId: "a", value: "Open" },
    { recordId: "b", value: "Open" },
    { recordId: "c", value: "Closed" },
  ]);
  assert.equal(plan.newConfig.role, "status"); // preserves existing config
  assert.deepEqual(
    plan.newConfig.options.map((o) => o.name),
    ["Open", "Closed"],
  );
  assert.equal(plan.clearRecordIds.length, 0);
});

test("select -> multi-select wraps, multi-select -> select takes first", () => {
  const wrap = planPropertyConversion("select", "multi-select", {}, [
    { recordId: "a", value: "Red" },
  ]);
  assert.deepEqual(wrap.updates, [{ record_id: "a", value: ["Red"] }]);

  const first = planPropertyConversion("multi-select", "select", {}, [
    { recordId: "a", value: ["Red", "Blue"] },
    { recordId: "b", value: [] },
  ]);
  assert.deepEqual(first.updates, [{ record_id: "a", value: "Red" }]);
  assert.equal(first.clearRecordIds.length, 0); // empty array is skipped, not cleared
});

test("anything -> checkbox only from boolean-ish text", () => {
  const plan = planPropertyConversion("text", "checkbox", {}, [
    { recordId: "a", value: "yes" },
    { recordId: "b", value: "false" },
    { recordId: "c", value: "maybe" },
  ]);
  assert.deepEqual(plan.updates, [
    { record_id: "a", value: true },
    { record_id: "b", value: false },
  ]);
  assert.deepEqual(plan.clearRecordIds, ["c"]);
});

test("date <-> text round trips ISO", () => {
  const toText = planPropertyConversion("date", "text", {}, [
    { recordId: "a", value: "2026-07-16T00:00:00.000Z" },
  ]);
  assert.equal(toText.updates[0].value, "2026-07-16T00:00:00.000Z");

  const toDate = planPropertyConversion("text", "date", {}, [
    { recordId: "a", value: "2026-07-16" },
    { recordId: "b", value: "not a date" },
  ]);
  assert.ok(toDate.updates[0].value.startsWith("2026-07-16"));
  assert.deepEqual(toDate.clearRecordIds, ["b"]);
});

test("incompatible pair clears all non-empty values", () => {
  const plan = planPropertyConversion("relation", "number", {}, [
    { recordId: "a", value: "some-uuid" },
    { recordId: "b", value: null },
  ]);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.clearRecordIds, ["a"]);
});
