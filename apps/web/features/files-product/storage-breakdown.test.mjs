import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStorageSegments,
  computeCategoryBytes,
  largestStorageFiles,
  segmentPercentOfCap,
} from "./storage-breakdown.ts";

test("computeCategoryBytes buckets by mime family", () => {
  const totals = computeCategoryBytes([
    { mime_type: "image/png", size_bytes: 100 },
    { mime_type: "application/pdf", size_bytes: 50 },
    { mime_type: "text/plain", size_bytes: 25 },
    { mime_type: null, size_bytes: 10 },
  ]);
  assert.equal(totals.images, 100);
  assert.equal(totals.pdfs, 50);
  assert.equal(totals.documents, 35);
});

test("buildStorageSegments skips empty categories and keeps order", () => {
  const segments = buildStorageSegments([
    { mime_type: "application/pdf", size_bytes: 200 },
    { mime_type: "image/jpeg", size_bytes: 100 },
  ]);
  assert.deepEqual(
    segments.map((segment) => segment.id),
    ["images", "pdfs"],
  );
});

test("segmentPercentOfCap clamps to 100", () => {
  assert.equal(segmentPercentOfCap(50, 100), 50);
  assert.equal(segmentPercentOfCap(200, 100), 100);
  assert.equal(segmentPercentOfCap(10, 0), 0);
});

test("largestStorageFiles sorts descending and limits", () => {
  const files = largestStorageFiles(
    [
      { id: "a", name: "a", mime_type: "image/png", size_bytes: 10 },
      { id: "b", name: "b", mime_type: "image/png", size_bytes: 30 },
      { id: "c", name: "c", mime_type: "image/png", size_bytes: 0 },
      { id: "d", name: "d", mime_type: "image/png", size_bytes: 20 },
    ],
    2,
  );
  assert.deepEqual(
    files.map((file) => file.id),
    ["b", "d"],
  );
});
