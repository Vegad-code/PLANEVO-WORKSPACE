import assert from "node:assert/strict";
import test from "node:test";

import {
  LocalDocumentStateConflictError,
  buildRestoredLocalDocumentState,
  reconcileLocalDocumentSource,
  selectGlobalLocalRevisionKeys,
} from "./local-document-state.ts";
import {
  DOCX_MIME_TYPE,
  localBinaryDocumentContent,
  localTextDocumentContent,
  validateLocalEditableFileMetadata,
} from "./local-document-content.ts";

const textMetadata = {
  hasUtf8Bom: false,
  newline: "lf",
  trailingNewline: false,
};

function text(content) {
  return localTextDocumentContent({ text: content, textMetadata });
}

function revision(id, version, content, createdAt = "2026-07-30T12:00:00.000Z") {
  return {
    id,
    version,
    content,
    sizeBytes: content.kind === "text" ? content.text.length : content.bytes.byteLength,
    reason: "checkpoint",
    createdAt,
    expiresAt: "2026-08-06T12:00:00.000Z",
  };
}

test("reconciles a disk-first partial commit when recovery bytes match the new source", () => {
  assert.deepEqual(
    reconcileLocalDocumentSource({
      version: 7,
      sourceHash: "old",
      sidecarHash: "old",
      diskHash: "new",
      recovery: { baseVersion: 7, contentHash: "new" },
    }),
    {
      action: "adopt-disk",
      version: 8,
      checkpointPriorContent: true,
      clearRecovery: true,
      reason: "completed-partial-save",
    },
  );
});

test("keeps meaningful recovery work when the original changed independently", () => {
  assert.throws(
    () =>
      reconcileLocalDocumentSource({
        version: 7,
        sourceHash: "old",
        sidecarHash: "old",
        diskHash: "external",
        recovery: { baseVersion: 7, contentHash: "draft" },
      }),
    LocalDocumentStateConflictError,
  );
});

test("refreshes source metadata without a conflict when only mtime changed", () => {
  assert.deepEqual(
    reconcileLocalDocumentSource({
      version: 7,
      sourceHash: "same",
      sidecarHash: "same",
      diskHash: "same",
      recovery: null,
    }),
    {
      action: "keep-sidecar",
      version: 7,
      checkpointPriorContent: false,
      clearRecovery: false,
      reason: "same-source",
    },
  );
});

test("restore enforces baseVersion and checkpoints current content so restore is undoable", () => {
  const current = text("current");
  const target = revision("older", 2, text("older"));
  const restored = buildRestoredLocalDocumentState({
    version: 4,
    baseVersion: 4,
    content: current,
    revisions: [target],
    revisionId: target.id,
    revisionIdFactory: () => "undo-restore",
    now: new Date("2026-07-30T12:00:00.000Z"),
  });

  assert.equal(restored.version, 5);
  assert.equal(restored.content.kind, "text");
  assert.equal(restored.content.text, "older");
  assert.equal(restored.revisions[0].id, "undo-restore");
  assert.equal(restored.revisions[0].content.text, "current");
  assert.throws(
    () =>
      buildRestoredLocalDocumentState({
        version: 5,
        baseVersion: 4,
        content: current,
        revisions: [target],
        revisionId: target.id,
        revisionIdFactory: () => "unused",
        now: new Date("2026-07-30T12:00:00.000Z"),
      }),
    LocalDocumentStateConflictError,
  );
});

test("globally expires old revisions and evicts the oldest documents under pressure", () => {
  const retained = selectGlobalLocalRevisionKeys({
    revisions: [
      {
        key: "a:new",
        sizeBytes: 7,
        createdAt: "2026-07-30T12:00:00.000Z",
        expiresAt: "2026-08-06T12:00:00.000Z",
      },
      {
        key: "b:old",
        sizeBytes: 7,
        createdAt: "2026-07-29T12:00:00.000Z",
        expiresAt: "2026-08-06T12:00:00.000Z",
      },
      {
        key: "c:expired",
        sizeBytes: 1,
        createdAt: "2026-07-28T12:00:00.000Z",
        expiresAt: "2026-07-29T12:00:00.000Z",
      },
    ],
    maximumBytes: 10,
    now: new Date("2026-07-30T13:00:00.000Z"),
  });

  assert.deepEqual([...retained], ["a:new"]);
});

test("allows an empty text file but requires a nonempty canonical DOCX under 25 MB", () => {
  assert.deepEqual(
    validateLocalEditableFileMetadata({
      name: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 0,
    }),
    { format: "text", mimeType: "text/plain" },
  );
  assert.deepEqual(
    validateLocalEditableFileMetadata({
      name: "plan.docx",
      mimeType: "",
      sizeBytes: 128,
    }),
    { format: "docx", mimeType: DOCX_MIME_TYPE },
  );
  assert.throws(() =>
    validateLocalEditableFileMetadata({
      name: "empty.docx",
      mimeType: DOCX_MIME_TYPE,
      sizeBytes: 0,
    }),
  );
  assert.throws(() =>
    validateLocalEditableFileMetadata({
      name: "fake.docx",
      mimeType: "text/plain",
      sizeBytes: 128,
    }),
  );
});

test("copies binary content while building an undoable restore checkpoint", () => {
  const current = localBinaryDocumentContent(new Uint8Array([1, 2, 3]));
  const target = revision(
    "older-docx",
    1,
    localBinaryDocumentContent(new Uint8Array([4, 5, 6])),
  );
  const restored = buildRestoredLocalDocumentState({
    version: 2,
    baseVersion: 2,
    content: current,
    revisions: [target],
    revisionId: target.id,
    revisionIdFactory: () => "undo-docx",
    now: new Date("2026-07-30T12:00:00.000Z"),
  });
  new Uint8Array(current.bytes)[0] = 9;

  assert.deepEqual([...new Uint8Array(restored.revisions[0].content.bytes)], [1, 2, 3]);
});
