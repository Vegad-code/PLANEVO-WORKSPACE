import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_LOCAL_BINARY_REVISION_BYTES,
  MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES,
  canRecordLocalDocumentRevision,
  copyLocalDocumentContent,
  localBinaryDocumentContent,
  localDocumentContentBytes,
  localDocumentContentSizeBytes,
  localTextDocumentContent,
  retainLocalDocumentRevisions,
} from "./local-document-content.ts";

test("copies binary document content without sharing the caller's bytes", () => {
  const source = new Uint8Array([0, 80, 75, 3, 4]);
  const content = localBinaryDocumentContent(source);
  source[1] = 0;

  assert.deepEqual([...localDocumentContentBytes(content)], [0, 80, 75, 3, 4]);
  assert.equal(localDocumentContentSizeBytes(content), 5);
});

test("snapshots binary revisions and bounds their retained size", () => {
  const source = localBinaryDocumentContent(new Uint8Array([1, 2, 3]));
  const snapshot = copyLocalDocumentContent(source);
  assert.equal(snapshot.kind, "binary");
  if (snapshot.kind === "binary") {
    new Uint8Array(source.bytes)[0] = 9;
    assert.deepEqual([...localDocumentContentBytes(snapshot)], [1, 2, 3]);
  }
  assert.equal(canRecordLocalDocumentRevision(source), true);
  assert.equal(
    canRecordLocalDocumentRevision(
      localBinaryDocumentContent(
        new Uint8Array(MAX_LOCAL_BINARY_REVISION_BYTES + 1),
      ),
    ),
    false,
  );
});

test("keeps text metadata with the text branch", () => {
  const content = localTextDocumentContent({
    text: "one\r\ntwo\r\n",
    textMetadata: {
      hasUtf8Bom: true,
      newline: "crlf",
      trailingNewline: true,
    },
  });

  assert.equal(content.kind, "text");
  assert.equal(localDocumentContentSizeBytes(content), 10);
});

test("evicts older DOCX revisions once their combined local history reaches the quota", () => {
  const revision = (id, byteLength) => ({
    id,
    sizeBytes: byteLength,
    content: localBinaryDocumentContent(new Uint8Array(byteLength)),
  });
  const retained = retainLocalDocumentRevisions([
    revision("newest", 16 * 1024 * 1024),
    revision("newer", 16 * 1024 * 1024),
    revision("middle", 16 * 1024 * 1024),
    revision("older", 16 * 1024 * 1024),
    revision("evicted", 1),
  ]);

  assert.equal(MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES, 64 * 1024 * 1024);
  assert.deepEqual(retained.map((item) => item.id), [
    "newest",
    "newer",
    "middle",
    "older",
  ]);
});
