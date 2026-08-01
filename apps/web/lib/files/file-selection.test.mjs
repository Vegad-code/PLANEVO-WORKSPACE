import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyFileListSelection,
  fileListSelectAllIntent,
  fileListSelectAllState,
  fileListSelectionCount,
  isFileListSelected,
  reduceFileListSelection,
} from "./file-selection.ts";

const VISIBLE = ["a", "b", "c", "d", "e"];

test("toggle adds then removes without dropping other selections", () => {
  let state = reduceFileListSelection(emptyFileListSelection(), {
    type: "toggle",
    id: "a",
  });
  assert.deepEqual(state.selectedIds, ["a"]);
  assert.equal(isFileListSelected(state, "a"), true);
  assert.equal(fileListSelectionCount(state), 1);

  state = reduceFileListSelection(state, { type: "toggle", id: "c" });
  assert.deepEqual(state.selectedIds, ["a", "c"]);

  state = reduceFileListSelection(state, { type: "toggle", id: "a" });
  assert.deepEqual(state.selectedIds, ["c"]);
  assert.equal(isFileListSelected(state, "a"), false);
});

test("clear empties selection", () => {
  const state = reduceFileListSelection(
    { selectedIds: ["a", "b"] },
    { type: "clear" },
  );
  assert.deepEqual(state, emptyFileListSelection());
});

test("set dedupes ids and preserves first-seen order", () => {
  const state = reduceFileListSelection(emptyFileListSelection(), {
    type: "set",
    ids: ["a", "b", "a", "c"],
  });
  assert.deepEqual(state.selectedIds, ["a", "b", "c"]);
});

test("set can empty the selection", () => {
  const state = reduceFileListSelection(
    { selectedIds: ["a"] },
    { type: "set", ids: [] },
  );
  assert.deepEqual(state.selectedIds, []);
});

test("select-all state is none when nothing visible is selected", () => {
  assert.equal(
    fileListSelectAllState({ selectedIds: ["z"], visibleIds: VISIBLE }),
    "none",
  );
  assert.equal(
    fileListSelectAllState({ selectedIds: [], visibleIds: VISIBLE }),
    "none",
  );
  assert.equal(
    fileListSelectAllState({ selectedIds: ["a"], visibleIds: [] }),
    "none",
  );
});

test("select-all state is some when a subset of visible rows is selected", () => {
  assert.equal(
    fileListSelectAllState({
      selectedIds: ["a", "c"],
      visibleIds: VISIBLE,
    }),
    "some",
  );
});

test("select-all state is all when every visible row is selected", () => {
  assert.equal(
    fileListSelectAllState({
      selectedIds: [...VISIBLE, "extra"],
      visibleIds: VISIBLE,
    }),
    "all",
  );
});

test("header checkbox from none selects all visible", () => {
  assert.deepEqual(
    fileListSelectAllIntent({ selectedIds: [], visibleIds: VISIBLE }),
    { type: "set", ids: VISIBLE },
  );
});

test("header checkbox from partial selects all visible", () => {
  assert.deepEqual(
    fileListSelectAllIntent({
      selectedIds: ["b", "d"],
      visibleIds: VISIBLE,
    }),
    { type: "set", ids: VISIBLE },
  );
});

test("header checkbox from all clears selection", () => {
  assert.deepEqual(
    fileListSelectAllIntent({
      selectedIds: VISIBLE,
      visibleIds: VISIBLE,
    }),
    { type: "clear" },
  );
});
