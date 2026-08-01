import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDocxOpenError,
  docxBytes,
  suggestedDocxCopyName,
} from "./docx-document-content.ts";

test("copies a DOCX recovery draft without retaining a shared typed-array view", () => {
  const backing = new Uint8Array([0, 0x50, 0x4b, 0x03, 0x04, 0]);
  const view = new Uint8Array(backing.buffer, 1, 4);
  const result = docxBytes(view);
  backing[1] = 0;

  assert.deepEqual(result ? [...result] : null, [0x50, 0x4b, 0x03, 0x04]);
});

test("accepts an ArrayBuffer recovery draft and rejects non-binary content", () => {
  const source = new Uint8Array([0x50, 0x4b, 0x05, 0x06]);

  assert.deepEqual(
    [...(docxBytes(source.buffer) ?? new Uint8Array())],
    [0x50, 0x4b, 0x05, 0x06],
  );
  assert.equal(docxBytes("PK"), null);
  assert.equal(docxBytes({ 0: 0x50, 1: 0x4b }), null);
});

test("keeps Save a copy filenames in the DOCX format", () => {
  assert.equal(suggestedDocxCopyName("Quarterly plan.docx"), "Quarterly plan copy.docx");
  assert.equal(suggestedDocxCopyName("Quarterly plan.DOCX"), "Quarterly plan copy.docx");
  assert.equal(suggestedDocxCopyName("Quarterly plan"), "Quarterly plan copy.docx");
  assert.equal(suggestedDocxCopyName("   "), "Document copy.docx");
});

test("explains encrypted and malformed DOCX failures without pretending content is editable", () => {
  assert.equal(
    describeDocxOpenError(new Error("Encrypted zip entries are unsupported")),
    "This DOCX is password-protected. Remove its password in Word, then open it again.",
  );
  assert.equal(
    describeDocxOpenError(new Error("Corrupted zip: central directory missing")),
    "This DOCX appears to be damaged or incomplete. Try opening a fresh copy.",
  );
  assert.equal(
    describeDocxOpenError(new Error("Worker stopped")),
    "Planevo could not open this DOCX. The original file has not been changed.",
  );
});
