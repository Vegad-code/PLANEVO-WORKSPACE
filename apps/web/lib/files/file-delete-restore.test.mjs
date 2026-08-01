import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRestoreSoftDeletedFile,
  formatBulkDeleteButtonLabel,
  formatBulkDeleteConfirmBody,
  formatBulkDeleteConfirmTitle,
  formatFilesDeletedToastMessage,
  formatFilesRestoredToastMessage,
  listBulkDeleteFileNames,
  shouldShowBulkDeleteFileList,
} from "./file-delete-restore.ts";

test("shows the file list disclosure only for multi-delete", () => {
  assert.equal(shouldShowBulkDeleteFileList(0), false);
  assert.equal(shouldShowBulkDeleteFileList(1), false);
  assert.equal(shouldShowBulkDeleteFileList(2), true);
});

test("confirm title names a single file and counts many", () => {
  assert.equal(
    formatBulkDeleteConfirmTitle([{ id: "1", name: "Brief.docx" }]),
    "Delete “Brief.docx”?",
  );
  assert.equal(
    formatBulkDeleteConfirmTitle([
      { id: "1", name: "a" },
      { id: "2", name: "b" },
    ]),
    "Delete 2 files?",
  );
});

test("confirm body explains soft-delete restore toast", () => {
  assert.match(formatBulkDeleteConfirmBody(1), /restore/i);
  assert.match(formatBulkDeleteConfirmBody(3), /selected files/i);
});

test("delete button label tracks multi-delete progress", () => {
  assert.equal(
    formatBulkDeleteButtonLabel({ count: 3, isDeleting: false }),
    "Delete files",
  );
  assert.equal(
    formatBulkDeleteButtonLabel({ count: 3, isDeleting: true, completed: 1 }),
    "Deleting 1 of 3…",
  );
  assert.equal(
    formatBulkDeleteButtonLabel({ count: 1, isDeleting: true, completed: 0 }),
    "Deleting…",
  );
});

test("toast copy for delete and restore", () => {
  assert.equal(formatFilesDeletedToastMessage(1), "File deleted");
  assert.equal(formatFilesDeletedToastMessage(4), "4 files deleted");
  assert.equal(formatFilesRestoredToastMessage(1), "File restored");
  assert.equal(formatFilesRestoredToastMessage(2), "2 files restored");
});

test("listBulkDeleteFileNames falls back for blank titles", () => {
  assert.deepEqual(
    listBulkDeleteFileNames([
      { id: "1", name: " Notes " },
      { id: "2", name: "   " },
    ]),
    ["Notes", "Untitled file"],
  );
});

test("canRestoreSoftDeletedFile respects purge window", () => {
  const now = Date.parse("2026-08-01T12:00:00.000Z");
  assert.equal(
    canRestoreSoftDeletedFile({
      deletedAt: "2026-07-31T12:00:00.000Z",
      purgeAfter: "2026-08-30T12:00:00.000Z",
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    canRestoreSoftDeletedFile({
      deletedAt: "2026-07-01T12:00:00.000Z",
      purgeAfter: "2026-07-31T12:00:00.000Z",
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    canRestoreSoftDeletedFile({
      deletedAt: null,
      purgeAfter: null,
      nowMs: now,
    }),
    false,
  );
});
