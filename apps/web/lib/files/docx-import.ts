/**
 * DOCX → markdown import for the Files markdown-shell editor.
 *
 * V1 uses mammoth's convertToMarkdown (already in package.json). Falls back to
 * extractRawText when markdown conversion fails so open still yields editable
 * content. Conversion messages become honest warnings — never silent drop.
 *
 * Upgrade path: when @eigenpal/docx-editor-core/markdown ships toMarkdown,
 * swap the converter behind this same result shape.
 */

import mammoth from "mammoth";

/** Calm banner copy when mammoth reports conversion limits. */
export const DOCX_IMPORT_LIMITS_BANNER =
  "Some formatting may not carry over.";

/** Surfaced when markdown conversion falls back to extractRawText. */
export const DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING =
  "Converted as plain text; some formatting may not carry over.";

export type DocxImportMessage = {
  type: "warning" | "error";
  message: string;
};

export type DocxImportSuccess = {
  kind: "ok";
  markdown: string;
  /** Human-readable notices for a calm conversion banner. */
  warnings: readonly string[];
  messages: readonly DocxImportMessage[];
};

export type DocxImportFailure = {
  kind: "error";
  error: string;
};

export type DocxImportResult = DocxImportSuccess | DocxImportFailure;

type MammothConversionResult = {
  value: string;
  messages: readonly {
    type: string;
    message: string;
  }[];
};

/**
 * mammoth's published .d.ts omits convertToMarkdown even though the runtime
 * exports it (1.12.x). Narrow through this local surface — no `any`.
 */
export type DocxImportMammothInput = {
  /** Node mammoth (`lib/unzip.js`) */
  buffer: Uint8Array;
  /** Browser mammoth (package `browser` field → `browser/unzip.js`) */
  arrayBuffer: ArrayBuffer;
};

export type DocxImportConverter = {
  convertToMarkdown: (
    input: DocxImportMammothInput,
  ) => Promise<MammothConversionResult>;
  extractRawText: (
    input: DocxImportMammothInput,
  ) => Promise<MammothConversionResult>;
};

export type ImportDocxToMarkdownArgs = {
  bytes: Uint8Array;
  /** Test seam / future swap — defaults to mammoth. */
  converter?: DocxImportConverter;
};

const defaultMammothConverter = mammoth as unknown as DocxImportConverter;

/**
 * Provide both Node (`buffer`) and browser (`arrayBuffer`) inputs. Mammoth's
 * package `browser` field swaps unzip implementations; each reads one key.
 */
function toMammothInput(bytes: Uint8Array): DocxImportMammothInput {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { buffer: copy, arrayBuffer: copy.buffer };
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function mapMessages(
  messages: MammothConversionResult["messages"],
): DocxImportMessage[] {
  const mapped: DocxImportMessage[] = [];
  for (const message of messages) {
    if (message.type === "warning" || message.type === "error") {
      mapped.push({ type: message.type, message: message.message });
      continue;
    }
    mapped.push({ type: "warning", message: message.message });
  }
  return mapped;
}

function warningStrings(messages: readonly DocxImportMessage[]): string[] {
  return messages.map((message) => message.message);
}

function successFromConversion(input: {
  value: string;
  messages: MammothConversionResult["messages"];
  extraWarnings?: readonly string[];
}): DocxImportSuccess {
  const messages = mapMessages(input.messages);
  const warnings = [
    ...warningStrings(messages),
    ...(input.extraWarnings ?? []),
  ];
  return {
    kind: "ok",
    markdown: normalizeMarkdown(input.value),
    warnings,
    messages,
  };
}

function failureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message;
  }
  return "Unable to convert this DOCX to markdown.";
}

/**
 * Convert DOCX package bytes into markdown for the Planevo Files shell.
 * Returns a discriminated result — callers keep prior state on `kind: "error"`.
 */
export async function importDocxToMarkdown({
  bytes,
  converter = defaultMammothConverter,
}: ImportDocxToMarkdownArgs): Promise<DocxImportResult> {
  if (bytes.byteLength === 0) {
    return { kind: "error", error: "DOCX bytes are empty." };
  }

  const input = toMammothInput(bytes);

  try {
    const converted = await converter.convertToMarkdown(input);
    const markdown = normalizeMarkdown(converted.value);

    if (markdown.trim().length === 0) {
      const raw = await converter.extractRawText(input);
      const rawText = normalizeMarkdown(raw.value);
      if (rawText.trim().length > 0) {
        return successFromConversion({
          value: rawText,
          messages: [...converted.messages, ...raw.messages],
          extraWarnings: [DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING],
        });
      }
    }

    return successFromConversion({
      value: markdown,
      messages: converted.messages,
    });
  } catch (markdownError) {
    try {
      const raw = await converter.extractRawText(input);
      return successFromConversion({
        value: raw.value,
        messages: raw.messages,
        extraWarnings: [DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING],
      });
    } catch {
      return { kind: "error", error: failureMessage(markdownError) };
    }
  }
}

/**
 * Banner text when import produced conversion notices; null when clean.
 */
export function docxImportBannerText(input: {
  warnings: readonly string[];
}): string | null {
  if (input.warnings.length === 0) return null;
  return DOCX_IMPORT_LIMITS_BANNER;
}
