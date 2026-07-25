import assert from "node:assert/strict";
import { test } from "node:test";
import { isVirtualStoragePath, parseStorageLocation } from "./delete-entities.ts";

test("parseStorageLocation routes bare paths to workspace-files", () => {
  assert.deepEqual(parseStorageLocation("ws-123/abc-file.pdf"), {
    bucket: "workspace-files",
    path: "ws-123/abc-file.pdf",
  });
});

test("parseStorageLocation reads the bucket prefix for page-assets", () => {
  assert.deepEqual(parseStorageLocation("page-assets:owner-1/uuid-logo.png"), {
    bucket: "page-assets",
    path: "owner-1/uuid-logo.png",
  });
});

test("parseStorageLocation skips virtual and empty paths", () => {
  assert.equal(parseStorageLocation("page:page-42"), null);
  assert.equal(parseStorageLocation(""), null);
  assert.ok(isVirtualStoragePath("page:page-42"));
});

test("parseStorageLocation keeps unknown prefixes in workspace-files", () => {
  // Sanitized filenames never contain a colon, but stay defensive if one leaks.
  assert.deepEqual(parseStorageLocation("weird:thing"), {
    bucket: "workspace-files",
    path: "weird:thing",
  });
});
