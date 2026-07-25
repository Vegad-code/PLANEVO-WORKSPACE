import assert from "node:assert/strict";
import test from "node:test";
import { buildFolderTree } from "./file-folders.ts";

test("buildFolderTree emits pre-order DFS with sibling ordering and counts", () => {
  const folders = [
    { id: "b", parent_id: null, name: "Beta", position: 2 },
    { id: "a", parent_id: null, name: "Alpha", position: 1 },
    { id: "a1", parent_id: "a", name: "Alpha child", position: 1 },
    { id: "a0", parent_id: "a", name: "Alpha first", position: 0 },
  ];
  const counts = new Map([
    ["a", 3],
    ["a0", 1],
  ]);
  const tree = buildFolderTree(folders, counts);
  assert.deepEqual(
    tree.map((node) => [node.id, node.depth, node.fileCount]),
    [
      ["a", 0, 3],
      ["a0", 1, 1],
      ["a1", 1, 0],
      ["b", 0, 0],
    ],
  );
});

test("buildFolderTree breaks position ties by name and roots dangling parents", () => {
  const folders = [
    { id: "y", parent_id: null, name: "Y", position: 0 },
    { id: "x", parent_id: null, name: "X", position: 0 },
    { id: "orphan", parent_id: "missing", name: "Orphan", position: 0 },
  ];
  const tree = buildFolderTree(folders, new Map());
  assert.deepEqual(
    tree.map((node) => node.id),
    ["orphan", "x", "y"],
  );
});
