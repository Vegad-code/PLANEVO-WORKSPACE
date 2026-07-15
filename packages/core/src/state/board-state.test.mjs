import assert from "node:assert/strict";
import test from "node:test";

const { groupIntoColumns, NO_GROUP_LABEL } = await import("./board-state.ts");

const OPTIONS = ["To do", "In progress", "Done"];

test("configured options always appear, in order, even when empty", () => {
  const columns = groupIntoColumns([], () => null, OPTIONS);
  assert.deepEqual(columns.map((column) => column.label), OPTIONS);
});

test("orphan status values get their own appended column instead of vanishing", () => {
  const items = [
    { id: 1, status: "To do" },
    { id: 2, status: "Blocked" },
    { id: 3, status: "Blocked" },
  ];
  const columns = groupIntoColumns(items, (item) => item.status, OPTIONS);
  assert.deepEqual(
    columns.map((column) => column.label),
    ["To do", "In progress", "Done", "Blocked"],
  );
  assert.equal(columns.find((column) => column.label === "Blocked").items.length, 2);
});

test("items without a group land in a trailing no-status lane", () => {
  const items = [
    { id: 1, status: null },
    { id: 2, status: "  " },
    { id: 3, status: "Done" },
  ];
  const columns = groupIntoColumns(items, (item) => item.status, OPTIONS);
  const last = columns[columns.length - 1];
  assert.equal(last.label, NO_GROUP_LABEL);
  assert.equal(last.items.length, 2);
});

test("total items across columns always equals the input count", () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    status: ["To do", "Weird", null, "Done"][index % 4],
  }));
  const columns = groupIntoColumns(items, (item) => item.status, OPTIONS);
  const total = columns.reduce((sum, column) => sum + column.items.length, 0);
  assert.equal(total, items.length);
});
