import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildScopedBrowseList,
  filterEntriesByScope,
  loadSpotlightScope,
  saveSpotlightScope,
  setSpotlightScope,
  SPOTLIGHT_SCOPE_STORAGE_KEY,
} from "./spotlight-scope.ts";

const ENTRIES = [
  { kind: "task", id: "t1", title: "Task one" },
  { kind: "event", id: "e1", title: "Event one" },
  { kind: "file", id: "f1", title: "File one" },
  { kind: "page", id: "p1", title: "Page one" },
];

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, value);
  },
  removeItem: (key) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
  key: () => null,
  length: 0,
};

test("null scope returns all entries", () => {
  assert.equal(filterEntriesByScope(ENTRIES, null).length, 4);
});

test("tasks scope filters tasks only", () => {
  const result = filterEntriesByScope(ENTRIES, "tasks");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "task");
});

test("workspace scope includes page database record", () => {
  const entries = [
    ...ENTRIES,
    { kind: "database", id: "d1", title: "Db one" },
    { kind: "record", id: "r1", title: "Record one" },
  ];
  const result = filterEntriesByScope(entries, "workspace");
  assert.deepEqual(
    result.map((entry) => entry.kind).sort(),
    ["database", "page", "record"],
  );
});

test("setSpotlightScope switches and clears", () => {
  assert.equal(setSpotlightScope(null, "tasks"), "tasks");
  assert.equal(setSpotlightScope("tasks", "tasks"), null);
  assert.equal(setSpotlightScope("tasks", "files"), "files");
});

test("persistence round-trip", () => {
  storage.clear();
  saveSpotlightScope("calendar");
  assert.equal(loadSpotlightScope(), "calendar");
  saveSpotlightScope(null);
  assert.equal(loadSpotlightScope(), null);
});

test("legacy array persistence migrates first scope", () => {
  storage.clear();
  sessionStorage.setItem(SPOTLIGHT_SCOPE_STORAGE_KEY, JSON.stringify(["files", "tasks"]));
  assert.equal(loadSpotlightScope(), "files");
  saveSpotlightScope(null);
});

test("buildScopedBrowseList merges recents then index", () => {
  const recents = [{ kind: "task", id: "r1", title: "Recent task" }];
  const entries = [
    { kind: "task", id: "r1", title: "Recent task" },
    { kind: "task", id: "t2", title: "Indexed task", updatedAt: "2026-07-03T00:00:00.000Z" },
  ];
  const merged = buildScopedBrowseList(recents, entries, 10);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.id, "r1");
  assert.equal(merged[1]?.id, "t2");
});
