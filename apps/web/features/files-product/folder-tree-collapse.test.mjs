import assert from "node:assert/strict";
import test from "node:test";
import {
  folderAncestorIds,
  folderHasChildren,
  isHiddenByCollapsedAncestor,
  visibleFolderEntries,
} from "./folder-tree-collapse.ts";

const TREE = [
  { id: "a", name: "A", parentId: null, depth: 0, position: 1, fileCount: 0 },
  { id: "b", name: "B", parentId: "a", depth: 1, position: 1, fileCount: 0 },
  { id: "c", name: "C", parentId: "b", depth: 2, position: 1, fileCount: 0 },
  { id: "d", name: "D", parentId: "a", depth: 1, position: 2, fileCount: 0 },
  { id: "e", name: "E", parentId: null, depth: 0, position: 2, fileCount: 0 },
];

test("folderHasChildren detects direct children only", () => {
  assert.equal(folderHasChildren(TREE, 0), true);
  assert.equal(folderHasChildren(TREE, 1), true);
  assert.equal(folderHasChildren(TREE, 2), false);
  assert.equal(folderHasChildren(TREE, 3), false);
  assert.equal(folderHasChildren(TREE, 4), false);
});

test("isHiddenByCollapsedAncestor hides nested rows under collapsed parents", () => {
  const collapsed = new Set(["b"]);
  assert.equal(isHiddenByCollapsedAncestor(TREE, 0, collapsed), false);
  assert.equal(isHiddenByCollapsedAncestor(TREE, 1, collapsed), false);
  assert.equal(isHiddenByCollapsedAncestor(TREE, 2, collapsed), true);
  assert.equal(isHiddenByCollapsedAncestor(TREE, 3, collapsed), false);
});

test("collapsing a root hides the whole subtree", () => {
  const collapsed = new Set(["a"]);
  assert.deepEqual(
    visibleFolderEntries(TREE, collapsed).map((entry) => entry.folder.id),
    ["a", "e"],
  );
});

test("folderAncestorIds walks root to parent", () => {
  assert.deepEqual(folderAncestorIds(TREE, "c"), ["a", "b"]);
  assert.deepEqual(folderAncestorIds(TREE, "d"), ["a"]);
  assert.deepEqual(folderAncestorIds(TREE, "a"), []);
  assert.deepEqual(folderAncestorIds(TREE, "missing"), []);
});
