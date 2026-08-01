/**
 * DOCX open path — convert package bytes to markdown for the Files shell.
 *
 * Keeps mammoth import out of the panel/editor bodies so Task 3 can swap the
 * shell without re-owning conversion. Call from the document load path after
 * bytes are available (hosted or local).
 */

import {
  docxImportBannerText,
  importDocxToMarkdown,
} from "@/lib/files/docx-import";

export type OpenDocxDocumentArgs = {
  bytes: Uint8Array;
};

export type OpenDocxDocumentSuccess = {
  kind: "ok";
  /** Copy of the source package bytes (immutable for the session). */
  bytes: Uint8Array;
  markdown: string;
  warnings: readonly string[];
  bannerText: string | null;
};

export type OpenDocxDocumentFailure = {
  kind: "error";
  error: string;
};

export type OpenDocxDocumentResult =
  | OpenDocxDocumentSuccess
  | OpenDocxDocumentFailure;

/**
 * Import a DOCX into markdown + calm conversion banner state for the editor.
 */
export async function openDocxDocument({
  bytes,
}: OpenDocxDocumentArgs): Promise<OpenDocxDocumentResult> {
  const imported = await importDocxToMarkdown({ bytes });
  if (imported.kind === "error") {
    return { kind: "error", error: imported.error };
  }

  return {
    kind: "ok",
    bytes: new Uint8Array(bytes),
    markdown: imported.markdown,
    warnings: imported.warnings,
    bannerText: docxImportBannerText({ warnings: imported.warnings }),
  };
}
