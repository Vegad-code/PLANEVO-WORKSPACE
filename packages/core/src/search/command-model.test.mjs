import assert from "node:assert/strict";
import test from "node:test";
import { COMMANDS, buildCommandResults } from "./command-model.ts";

const REFERENCE = new Date("2026-07-16T15:00:00.000Z"); // Thursday

const entries = [
  { kind: "page", id: "p1", title: "Physics notes" },
  { kind: "database", id: "d1", title: "Tasks" },
  { kind: "database", id: "d2", title: "Projects" },
  { kind: "record", id: "r1", title: "Read chapter 4" },
  { kind: "record", id: "r2", title: "Physics homework" },
  { kind: "task", id: "t1", title: "Physics lab prep" },
  { kind: "file", id: "f1", title: "Physics syllabus.pdf" },
  { kind: "event", id: "e1", title: "Physics office hours" },
];

test("empty query returns recents", () => {
  const recents = [entries[0]];
  const results = buildCommandResults({ query: "", entries, recents });
  assert.equal(results.length, 1);
  assert.equal(results[0].type, "entry");
  assert.equal(results[0].entry.id, "p1");
});

test("'>' lists commands, and filters them", () => {
  const all = buildCommandResults({ query: ">", entries });
  assert.equal(all.length, COMMANDS.length);
  assert.ok(all.every((r) => r.type === "command"));

  const filtered = buildCommandResults({ query: ">new page", entries });
  assert.equal(filtered[0].type, "command");
  assert.equal(filtered[0].command.id, "new-page");
});

test("'@' searches records only", () => {
  const results = buildCommandResults({ query: "@physics", entries });
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.type === "entry" && r.entry.kind === "record"));
  assert.equal(results[0].entry.id, "r2");
});

test("'#' searches databases only", () => {
  const results = buildCommandResults({ query: "#proj", entries });
  assert.ok(results.every((r) => r.type === "entry" && r.entry.kind === "database"));
  assert.equal(results[0].entry.id, "d2");
});

test("default mode puts capture FIRST when the line has a signal", () => {
  const results = buildCommandResults({
    query: "Physics homework friday 6pm",
    entries,
    referenceDate: REFERENCE,
  });
  assert.equal(results[0].type, "capture");
  assert.equal(results[0].draft.title, "Physics homework");
  assert.equal(results[0].draft.time.hour, 18);
});

test("default mode without a signal is pure fuzzy nav", () => {
  const results = buildCommandResults({ query: "physics", entries, referenceDate: REFERENCE });
  assert.ok(results.every((r) => r.type === "entry"));
  assert.ok(results.some((r) => r.entry.id === "p1"));
});

test("default mode ranks product kinds alongside workspace entries", () => {
  const results = buildCommandResults({ query: "physics", entries, referenceDate: REFERENCE });
  const kinds = new Set(
    results.filter((r) => r.type === "entry").map((r) => r.entry.kind),
  );
  assert.ok(kinds.has("task"));
  assert.ok(kinds.has("file"));
  assert.ok(kinds.has("event"));
  assert.ok(kinds.has("page"));
});

test("COMMANDS no longer includes search-page", () => {
  assert.ok(!COMMANDS.some((command) => command.id === "search-page"));
});
