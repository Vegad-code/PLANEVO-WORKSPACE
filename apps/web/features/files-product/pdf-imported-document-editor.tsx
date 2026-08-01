"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  pdfExportBannerText,
  exportMarkdownToPdf,
} from "@/lib/files/pdf-export";
import {
  pdfImportBannerText,
  importPdfToMarkdown,
} from "@/lib/files/pdf-import";
import type { MarkdownViewMode } from "@/lib/files/editor-prefs";
import { TextDocumentEditor } from "./text-document-editor";

type PdfSerializer = () => Promise<Uint8Array>;

export type PdfImportedDocumentEditorProps = {
  bytes: Uint8Array;
  fileName: string;
  /**
   * Preloaded markdown from the panel open path (`openPdfDocument`). When set,
   * skips a second pdfjs pass.
   */
  initialMarkdown?: string;
  importWarnings?: readonly string[];
  viewMode?: MarkdownViewMode;
  onChange: () => void;
  onError: (error: Error) => void;
  onSaveRequest: () => void;
  onSerializerReady: (serialize: PdfSerializer | null) => void;
};

/** Production PDF open forces split in the panel; this is the test fallback. */
const DEFAULT_IMPORTED_VIEW: MarkdownViewMode = "split";

/**
 * Markdown shell for text-extractable PDFs. Converts PDF bytes to markdown on
 * open, then reuses the CodeMirror + ReactMarkdown split shell. Serialize
 * exports edited markdown back into PDF bytes via pdf-lib (same file_sources /
 * disk object).
 */
export function PdfImportedDocumentEditor({
  bytes,
  initialMarkdown,
  importWarnings,
  viewMode = DEFAULT_IMPORTED_VIEW,
  onChange,
  onError,
  onSaveRequest,
  onSerializerReady,
}: PdfImportedDocumentEditorProps) {
  const markdownRef = useRef<string | null>(
    typeof initialMarkdown === "string" ? initialMarkdown : null,
  );
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const hasPreloadedMarkdown = typeof initialMarkdown === "string";
  const [markdown, setMarkdown] = useState<string | null>(
    hasPreloadedMarkdown ? initialMarkdown : null,
  );
  const [importWarning, setImportWarning] = useState<string | null>(() =>
    hasPreloadedMarkdown
      ? pdfImportBannerText({ warnings: importWarnings ?? [] })
      : null,
  );
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasPreloadedMarkdown);

  markdownRef.current = markdown;

  const stableBytes = useMemo(() => new Uint8Array(bytes), [bytes]);

  useEffect(() => {
    setExportWarning(null);

    if (typeof initialMarkdown === "string") {
      setMarkdown(initialMarkdown);
      markdownRef.current = initialMarkdown;
      setImportWarning(
        pdfImportBannerText({ warnings: importWarnings ?? [] }),
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMarkdown(null);
    markdownRef.current = null;
    setImportWarning(null);

    void importPdfToMarkdown({ bytes: stableBytes }).then((result) => {
      if (cancelled) return;
      if (result.kind !== "ok") {
        onErrorRef.current(
          new Error(
            result.kind === "error"
              ? result.error
              : "This PDF could not be converted for editing.",
          ),
        );
        setLoading(false);
        return;
      }
      setMarkdown(result.markdown);
      markdownRef.current = result.markdown;
      setImportWarning(pdfImportBannerText({ warnings: result.warnings }));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [stableBytes, initialMarkdown, importWarnings]);

  const serialize = useCallback(async (): Promise<Uint8Array> => {
    const currentMarkdown = markdownRef.current;
    if (currentMarkdown === null) {
      throw new Error("The PDF editor is not ready yet.");
    }

    const result = await exportMarkdownToPdf({
      markdown: currentMarkdown,
    });

    if (result.kind === "error") {
      throw new Error(result.error);
    }

    setExportWarning(pdfExportBannerText({ warnings: result.warnings }));
    return new Uint8Array(result.bytes);
  }, []);

  useEffect(() => {
    if (loading || markdown === null) {
      onSerializerReady(null);
      return;
    }
    onSerializerReady(serialize);
    return () => onSerializerReady(null);
  }, [loading, markdown, onSerializerReady, serialize]);

  const handleMarkdownChange = useCallback(
    (value: string) => {
      setMarkdown(value);
      markdownRef.current = value;
      onChange();
    },
    [onChange],
  );

  const conversionBanner = importWarning ?? exportWarning;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="files-editor-shell flex h-full flex-col items-center justify-center gap-2 bg-transparent px-6 text-center"
      >
        <p className="text-product-body text-files-text">Opening document</p>
        <p className="max-w-sm text-product-meta text-files-text-muted">
          Converting to markdown for editing.
        </p>
      </div>
    );
  }

  if (markdown === null) {
    return null;
  }

  // Nested shell: layout-only; outer panel owns frost. TextDocumentEditor owns canvas.
  return (
    <div className="files-editor-shell flex h-full min-h-0 flex-1 flex-col bg-transparent">
      {conversionBanner ? (
        <div
          role="status"
          className="files-editor-banner"
        >
          {conversionBanner}
        </div>
      ) : null}
      <TextDocumentEditor
        value={markdown}
        onChange={handleMarkdownChange}
        format="markdown"
        viewMode={viewMode}
        onSaveNow={onSaveRequest}
      />
    </div>
  );
}
