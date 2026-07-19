import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isVisibleFileSourceMetadata,
  MAX_TASK_ATTACHMENT_BYTES,
} from "./task-attachments.ts";
import {
  requireTaskAttachmentCleanupCandidate,
  requireTaskAttachmentSize,
} from "./task-attachment-integrity.ts";

test("requireTaskAttachmentSize accepts an exact finite positive stored size", () => {
  assert.equal(requireTaskAttachmentSize(1_024, 1_024), 1_024);
});

test("requireTaskAttachmentSize rejects missing and malformed storage metadata", () => {
  for (const value of [undefined, null, "1024", Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => requireTaskAttachmentSize(value, 1_024), /valid size/i);
  }
});

test("requireTaskAttachmentSize rejects non-positive and oversized bytes", () => {
  for (const value of [0, -1, MAX_TASK_ATTACHMENT_BYTES + 1]) {
    assert.throws(() => requireTaskAttachmentSize(value), /valid size/i);
  }
});

test("requireTaskAttachmentSize rejects a stored size that differs from its descriptor", () => {
  assert.throws(() => requireTaskAttachmentSize(2_048, 1_024), /does not match/i);
});

test("cleanup candidate validation protects a claimed attachment", () => {
  assert.throws(
    () =>
      requireTaskAttachmentCleanupCandidate({
        source_kind: "task-attachment",
        task_attachment_state: "claimed",
      }),
    /claimed/i,
  );
  assert.doesNotThrow(() =>
    requireTaskAttachmentCleanupCandidate({
      source_kind: "task-attachment",
      task_attachment_state: "cleanup_pending",
    }),
  );
});

test("file surfaces hide only unclaimed or cleanup-pending task reservations", () => {
  assert.equal(isVisibleFileSourceMetadata({ source: "page-upload" }), true);
  assert.equal(
    isVisibleFileSourceMetadata({
      source_kind: "task-attachment",
      cleanup_required: true,
      task_attachment_state: "unclaimed",
    }),
    false,
  );
  assert.equal(
    isVisibleFileSourceMetadata({
      source_kind: "task-attachment",
      cleanup_required: true,
      task_attachment_state: "cleanup_pending",
    }),
    false,
  );
  assert.equal(
    isVisibleFileSourceMetadata({
      source_kind: "task-attachment",
      cleanup_required: false,
      task_attachment_state: "claimed",
    }),
    true,
  );
});
