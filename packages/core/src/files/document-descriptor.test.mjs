import assert from "node:assert/strict";
import test from "node:test";

import {
  documentFormatForFile,
  isEditableDocumentFormat,
  opensInDocumentEditorPanel,
  requiresRuntimeEditProbe,
} from "./document-descriptor.ts";

test("page-backed sources are Planevo documents", () => {
  assert.equal(
    documentFormatForFile({
      name: "Plan",
      mimeType: "application/x-planevo-page",
      pageId: "page-id",
    }),
    "planevo",
  );
});

test("recognizes lossless Markdown and plain-text formats", () => {
  assert.equal(
    documentFormatForFile({
      name: "notes.md",
      mimeType: "text/markdown",
      pageId: null,
    }),
    "markdown",
  );
  assert.equal(
    documentFormatForFile({
      name: "notes.MARKDOWN",
      mimeType: "application/octet-stream",
      pageId: null,
    }),
    "markdown",
  );
  assert.equal(
    documentFormatForFile({
      name: "notes.txt",
      mimeType: "text/plain",
      pageId: null,
    }),
    "text",
  );
});

test("keeps PDFs and unknown binary files out of the editor", () => {
  assert.equal(
    documentFormatForFile({
      name: "brief.pdf",
      mimeType: "application/pdf",
      pageId: null,
    }),
    "pdf",
  );
  assert.equal(
    documentFormatForFile({
      name: "brief.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pageId: null,
    }),
    "docx",
  );
  assert.equal(
    documentFormatForFile({
      name: "archive.zip",
      mimeType: "application/zip",
      pageId: null,
    }),
    "binary",
  );
  assert.equal(isEditableDocumentFormat("planevo"), true);
  assert.equal(isEditableDocumentFormat("markdown"), true);
  assert.equal(isEditableDocumentFormat("text"), true);
  assert.equal(isEditableDocumentFormat("docx"), true);
  assert.equal(isEditableDocumentFormat("pdf"), false);
});

test("PDF editability is runtime-probed, not static", () => {
  assert.equal(requiresRuntimeEditProbe("pdf"), true);
  assert.equal(requiresRuntimeEditProbe("docx"), false);
  assert.equal(opensInDocumentEditorPanel("pdf"), true);
  assert.equal(opensInDocumentEditorPanel("binary"), false);
});
