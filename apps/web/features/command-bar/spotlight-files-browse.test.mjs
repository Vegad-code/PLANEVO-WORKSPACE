import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFileRecents,
  buildFileSuggestions,
  filterFileEntriesByTab,
} from "./spotlight-files-browse.ts";

const FILES = [
  {
    kind: "file",
    id: "a",
    title: "a.pdf",
    mimeType: "application/pdf",
    starred: false,
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    kind: "file",
    id: "b",
    title: "b.png",
    mimeType: "image/png",
    starred: true,
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
  {
    kind: "file",
    id: "c",
    title: "c.txt",
    mimeType: "text/plain",
    starred: false,
    updatedAt: "2026-07-03T00:00:00.000Z",
  },
];

test("filterFileEntriesByTab pdfs", () => {
  const pdfs = filterFileEntriesByTab(FILES, "pdfs");
  assert.equal(pdfs.length, 1);
  assert.equal(pdfs[0]?.id, "a");
});

test("buildFileSuggestions starred first", () => {
  const suggestions = buildFileSuggestions(FILES, 2);
  assert.equal(suggestions[0]?.id, "b");
});

test("buildFileRecents dedupes recents and index", () => {
  const recents = [{ kind: "file", id: "a", title: "a.pdf" }];
  const merged = buildFileRecents(FILES, recents, 10);
  assert.equal(merged[0]?.id, "a");
  assert.ok(merged.length >= 2);
});
