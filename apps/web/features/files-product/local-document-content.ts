/**
 * The content shapes a local-disk document can hold, plus the identity checks a file has to pass
 * before Planevo is willing to autosave back over it.
 *
 * Pure: no React, no DOM, no IndexedDB. `local-file-repository.ts` owns the I/O and calls in here.
 */

import { documentFormatForFile } from "@planevo/core/files/document-descriptor";

import { MAX_PRODUCT_FILE_BYTES } from "../../lib/files/product-files.ts";
import type { TextDocumentMetadata } from "./document-client";

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * What a browser actually reports for a real .docx chosen from disk. Chromium usually gives the
 * canonical OOXML type, but an unregistered extension yields "" and some systems report the
 * generic binary type — none of which is grounds to refuse the file.
 */
const DOCX_SOURCE_MIME_TYPES: readonly string[] = [
  "",
  DOCX_MIME_TYPE,
  "application/octet-stream",
];

export const MAX_LOCAL_BINARY_REVISION_BYTES = 16 * 1024 * 1024;
/**
 * Binary history lives entirely in IndexedDB. A single revision is limited separately so one
 * large DOCX cannot consume the whole local quota, and this cumulative limit keeps repeated
 * autosave checkpoints bounded as well.
 */
export const MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES = 64 * 1024 * 1024;

export type LocalEditableFileFormat = "markdown" | "text" | "docx";

export type LocalEditableFileMetadata = {
  format: LocalEditableFileFormat;
  mimeType: string;
};

/**
 * Gate for any file Planevo is about to bind autosave to, whether it came from the open picker or
 * from a re-bind after a lost handle.
 *
 * The format is derived from the extension alone. Letting the reported mime type pick the format
 * would defeat the check it is here to perform: `fake.docx` announced as `text/plain` would come
 * back as a text document and then be opened by the text editor, which would rewrite it as UTF-8
 * and destroy whatever the file really was.
 */
export function validateLocalEditableFileMetadata({
  name,
  mimeType,
  sizeBytes,
}: {
  name: string;
  mimeType: string;
  sizeBytes: number;
}): LocalEditableFileMetadata {
  if (sizeBytes < 0 || sizeBytes > MAX_PRODUCT_FILE_BYTES) {
    throw new Error("Choose a file that is 25 MB or smaller.");
  }
  const format = documentFormatForFile({ name, mimeType: null, pageId: null });
  if (format !== "markdown" && format !== "text" && format !== "docx") {
    throw new Error("Choose a Markdown, text, or DOCX document.");
  }
  if (format !== "docx") {
    // An empty .txt or .md is a legitimate document to start editing, so size is not checked here.
    return {
      format,
      mimeType:
        mimeType || (format === "markdown" ? "text/markdown" : "text/plain"),
    };
  }
  if (!DOCX_SOURCE_MIME_TYPES.includes(mimeType)) {
    throw new Error("Choose a valid DOCX document.");
  }
  // A zero-byte .docx has no ZIP central directory, so it can never be opened, only overwritten.
  // Refusing it here means the editor never mounts against a file it would have to invent.
  if (sizeBytes <= 0) {
    throw new Error("This DOCX is empty. Choose a DOCX that has content.");
  }
  return { format: "docx", mimeType: DOCX_MIME_TYPE };
}

export type LocalTextDocumentContent = {
  kind: "text";
  text: string;
  textMetadata: TextDocumentMetadata;
};

export type LocalBinaryDocumentContent = {
  kind: "binary";
  bytes: ArrayBuffer;
};

export type LocalDocumentContent =
  | LocalTextDocumentContent
  | LocalBinaryDocumentContent;

export function localTextDocumentContent(input: {
  text: string;
  textMetadata: TextDocumentMetadata;
}): LocalTextDocumentContent {
  return {
    kind: "text",
    text: input.text,
    textMetadata: { ...input.textMetadata },
  };
}

export function localBinaryDocumentContent(
  bytes: Uint8Array,
): LocalBinaryDocumentContent {
  return { kind: "binary", bytes: copyLocalDocumentBytes(bytes) };
}

export function localDocumentContentBytes(
  content: LocalBinaryDocumentContent,
): Uint8Array {
  return new Uint8Array(content.bytes.slice(0));
}

export function copyLocalDocumentContent(
  content: LocalDocumentContent,
): LocalDocumentContent {
  return content.kind === "text"
    ? localTextDocumentContent(content)
    : localBinaryDocumentContent(localDocumentContentBytes(content));
}

export function localDocumentContentSizeBytes(
  content: LocalDocumentContent,
): number {
  return content.kind === "text"
    ? new TextEncoder().encode(content.text).byteLength
    : content.bytes.byteLength;
}

export function canRecordLocalDocumentRevision(
  content: LocalDocumentContent,
): boolean {
  return (
    content.kind === "text" ||
    content.bytes.byteLength <= MAX_LOCAL_BINARY_REVISION_BYTES
  );
}

/**
 * Keep the newest revisions first and evict only older binary snapshots once their cumulative
 * footprint reaches the local history cap. Text snapshots are intentionally not counted here:
 * their existing count/expiry caps already bound them and preserving them avoids changing the
 * established Markdown recovery behaviour.
 */
export function retainLocalDocumentRevisions<
  T extends { content: LocalDocumentContent; sizeBytes: number },
>(revisions: readonly T[]): T[] {
  let retainedBinaryBytes = 0;
  const retained: T[] = [];

  for (const revision of revisions) {
    if (revision.content.kind === "binary") {
      const byteLength = localDocumentContentSizeBytes(revision.content);
      if (
        byteLength > MAX_LOCAL_BINARY_REVISION_BYTES ||
        retainedBinaryBytes + byteLength > MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES
      ) {
        continue;
      }
      retainedBinaryBytes += byteLength;
    }
    retained.push(revision);
  }

  return retained;
}

function copyLocalDocumentBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}
