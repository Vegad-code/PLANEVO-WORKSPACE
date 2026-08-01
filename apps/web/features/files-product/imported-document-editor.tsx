"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  docxExportBannerText,
  exportMarkdownToDocx,
} from "@/lib/files/docx-export";
import {
  docxImportBannerText,
  importDocxToMarkdown,
} from "@/lib/files/docx-import";
import type { MarkdownViewMode } from "@/lib/files/editor-prefs";
import { TextDocumentEditor } from "./text-document-editor";

type DocxSerializer = () => Promise<Uint8Array>;

export type ImportedDocumentEditorProps = {
  bytes: Uint8Array;
  fileName: string;
  /**
   * Preloaded markdown from the panel open path (`openDocxDocument`). When set,
   * skips a second mammoth pass. Falls back to in-editor import when omitted.
   */
  initialMarkdown?: string;
  importWarnings?: readonly string[];
  viewMode?: MarkdownViewMode;
  onChange: () => void;
  onError: (error: Error) => void;
  onSaveRequest: () => void;
  onSerializerReady: (serialize: DocxSerializer | null) => void;
};

/** Fallback when the panel omits viewMode (tests). Production DOCX open forces split in the panel. */
const DEFAULT_IMPORTED_VIEW: MarkdownViewMode = "split";

/**
 * Markdown shell for imported binary documents (DOCX today). Converts package bytes
 * to markdown on open, then reuses the same CodeMirror + ReactMarkdown split shell as
 * native markdown files. Serialize exports edited markdown back into DOCX bytes via
 * package surgery on the cached original package (same file_sources / disk object).
 */
export function ImportedDocumentEditor({
  bytes,
  initialMarkdown,
  importWarnings,
  viewMode = DEFAULT_IMPORTED_VIEW,
  onChange,
  onError,
  onSaveRequest,
  onSerializerReady,
}: ImportedDocumentEditorProps) {
  // Open-time package shell — package surgery reuses this across autosave generations
  // so styles/rels survive; only word/document.xml is replaced from markdown.
  const originalBytesRef = useRef<Uint8Array>(new Uint8Array(bytes));
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
      ? docxImportBannerText({ warnings: importWarnings ?? [] })
      : null,
  );
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasPreloadedMarkdown);

  markdownRef.current = markdown;

  const stableBytes = useMemo(() => new Uint8Array(bytes), [bytes]);

  useEffect(() => {
    originalBytesRef.current = new Uint8Array(stableBytes);
    // Fresh open — clear prior session export notices until the next serialize.
    setExportWarning(null);

    if (typeof initialMarkdown === "string") {
      setMarkdown(initialMarkdown);
      markdownRef.current = initialMarkdown;
      setImportWarning(
        docxImportBannerText({ warnings: importWarnings ?? [] }),
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMarkdown(null);
    markdownRef.current = null;
    setImportWarning(null);

    void importDocxToMarkdown({ bytes: stableBytes }).then((result) => {
      if (cancelled) return;
      if (result.kind === "error") {
        onErrorRef.current(new Error(result.error));
        setLoading(false);
        return;
      }
      setMarkdown(result.markdown);
      markdownRef.current = result.markdown;
      setImportWarning(docxImportBannerText({ warnings: result.warnings }));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [stableBytes, initialMarkdown, importWarnings]);

  const serialize = useCallback(async (): Promise<Uint8Array> => {
    const currentMarkdown = markdownRef.current;
    if (currentMarkdown === null) {
      throw new Error("The DOCX editor is not ready yet.");
    }

    const result = await exportMarkdownToDocx({
      markdown: currentMarkdown,
      basePackage: originalBytesRef.current,
    });

    if (result.kind === "error") {
      throw new Error(result.error);
    }

    setExportWarning(docxExportBannerText({ warnings: result.warnings }));
    // Keep the open-time shell for the next generation — do not replace with the
    // surgically edited package, or a clean-fallback save would permanently lose
    // the original styles/rels for later autosaves.
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
