/**
 * Markdown → PDF export for the Files markdown-shell editor.
 *
 * V1 builds a clean text-centric PDF with pdf-lib (headings, paragraphs, lists,
 * bold/italic where StandardFonts support them). Honest content save — not
 * bit-identical page layout / fonts / images. Always surfaces a fidelity warning.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export const PDF_EXPORT_LIMITS_BANNER =
  "Some layout, images, and fonts may not carry over.";

export const PDF_EXPORT_FIDELITY_WARNING =
  "Exported as edited text; original page layout, vector graphics, form fields, annotations, and embedded images may not be preserved.";

export const PDF_EXPORT_UNSUPPORTED_GLYPH_WARNING =
  "Some characters could not be encoded in the PDF standard font and were replaced.";

export type PdfExportSuccess = {
  kind: "ok";
  bytes: Uint8Array;
  warnings: readonly string[];
};

export type PdfExportFailure = {
  kind: "error";
  error: string;
};

export type PdfExportResult = PdfExportSuccess | PdfExportFailure;

export type ExportMarkdownToPdfArgs = {
  markdown: string;
};

type InlineRun =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: InlineRun[] }
  | { kind: "italic"; children: InlineRun[] }
  | { kind: "code"; text: string };

type Block =
  | { kind: "heading"; level: number; runs: InlineRun[] }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "ul"; items: InlineRun[][] }
  | { kind: "ol"; items: InlineRun[][] }
  | { kind: "code_block"; text: string }
  | { kind: "blockquote"; runs: InlineRun[] }
  | { kind: "hr" };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function escapeForParse(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function expandLinksAndImages(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, href: string) => {
      const label = alt.trim() || "image";
      return `${label} (${href})`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

function parseInline(text: string): InlineRun[] {
  const source = expandLinksAndImages(text);
  const runs: InlineRun[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|__[^*_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ kind: "text", text: source.slice(lastIndex, match.index) });
    }
    const token = match[0]!;
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      runs.push({
        kind: "bold",
        children: [{ kind: "text", text: token.slice(2, -2) }],
      });
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      runs.push({
        kind: "italic",
        children: [{ kind: "text", text: token.slice(1, -1) }],
      });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push({ kind: "code", text: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < source.length) {
    runs.push({ kind: "text", text: source.slice(lastIndex) });
  }
  return runs.length > 0 ? runs : [{ kind: "text", text: "" }];
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());
}

export function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = escapeForParse(markdown).split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ kind: "hr" });
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]!.length,
        runs: parseInline(heading[2]!),
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.trim().startsWith("```")) {
        body.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code_block", text: body.join("\n") });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!.trim())) {
        quoteLines.push(lines[index]!.trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({
        kind: "blockquote",
        runs: parseInline(quoteLines.join(" ")),
      });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index]!.trim())) {
        items.push(parseInline(lines[index]!.trim().replace(/^[-*+]\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index]!.trim())) {
        items.push(
          parseInline(lines[index]!.trim().replace(/^\d+\.\s+/, "")),
        );
        index += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Skip markdown tables as plain paragraphs (V1 fidelity honesty).
    if (trimmed.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]!)) {
      const rowText = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .join(" — ");
      blocks.push({ kind: "paragraph", runs: parseInline(rowText) });
      index += 2;
      while (index < lines.length && lines[index]!.trim().includes("|")) {
        const next = lines[index]!
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim())
          .join(" — ");
        blocks.push({ kind: "paragraph", runs: parseInline(next) });
        index += 1;
      }
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(#{1,6})\s+/.test(lines[index]!.trim()) &&
      !/^[-*+]\s+/.test(lines[index]!.trim()) &&
      !/^\d+\.\s+/.test(lines[index]!.trim()) &&
      !/^>\s?/.test(lines[index]!.trim()) &&
      !lines[index]!.trim().startsWith("```") &&
      lines[index]!.trim() !== "---"
    ) {
      paragraphLines.push(lines[index]!.trim());
      index += 1;
    }
    blocks.push({
      kind: "paragraph",
      runs: parseInline(paragraphLines.join(" ")),
    });
  }

  return blocks;
}

function flattenRuns(runs: readonly InlineRun[]): string {
  const parts: string[] = [];
  for (const run of runs) {
    switch (run.kind) {
      case "text":
      case "code":
        parts.push(run.text);
        break;
      case "bold":
      case "italic":
        parts.push(flattenRuns(run.children));
        break;
      default: {
        const _exhaustive: never = run;
        void _exhaustive;
        break;
      }
    }
  }
  return parts.join("");
}

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

type DrawCursor = {
  page: PDFPage;
  y: number;
  doc: PDFDocument;
  fonts: FontSet;
  replacedUnsupportedGlyphs: boolean;
};

/**
 * StandardFonts are WinAnsi-only. Replace unsupported code points so a single
 * emoji cannot abort the whole export; surface honesty via a warning instead.
 */
export function sanitizeTextForStandardFont(input: {
  text: string;
  font: PDFFont;
}): { text: string; replaced: boolean } {
  const allowed = new Set(input.font.getCharacterSet());
  let replaced = false;
  let out = "";
  for (const char of input.text) {
    if (char === "\n" || char === "\r" || char === "\t") {
      out += " ";
      continue;
    }
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (allowed.has(code)) {
      out += char;
      continue;
    }
    out += "?";
    replaced = true;
  }
  return { text: out, replaced };
}

function ensureSpace(cursor: DrawCursor, needed: number): void {
  if (cursor.y - needed < MARGIN_BOTTOM) {
    cursor.page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor.y = PAGE_HEIGHT - MARGIN_TOP;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    // Hard-break oversized tokens.
    let remaining = word;
    while (remaining.length > 0) {
      let cut = remaining.length;
      while (
        cut > 1 &&
        font.widthOfTextAtSize(remaining.slice(0, cut), size) > maxWidth
      ) {
        cut -= 1;
      }
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }
    current = "";
  }
  if (current) lines.push(current);
  return lines;
}

function drawPlainLines(
  cursor: DrawCursor,
  text: string,
  options: { size: number; font: PDFFont; indent?: number; color?: ReturnType<typeof rgb> },
): void {
  const indent = options.indent ?? 0;
  const lineHeight = options.size * 1.35;
  // Preserve author line breaks (code fences / soft returns) before wrapping.
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  for (const paragraph of paragraphs) {
    const sanitized = sanitizeTextForStandardFont({
      text: paragraph,
      font: options.font,
    });
    if (sanitized.replaced) cursor.replacedUnsupportedGlyphs = true;
    const lines = wrapText(
      sanitized.text,
      options.font,
      options.size,
      CONTENT_WIDTH - indent,
    );
    for (const line of lines) {
      ensureSpace(cursor, lineHeight);
      cursor.page.drawText(line.length > 0 ? line : " ", {
        x: MARGIN_X + indent,
        y: cursor.y - options.size,
        size: options.size,
        font: options.font,
        color: options.color ?? rgb(0.1, 0.1, 0.1),
      });
      cursor.y -= lineHeight;
    }
  }
}

function drawRuns(
  cursor: DrawCursor,
  runs: readonly InlineRun[],
  options: { size: number; indent?: number },
): void {
  // V1: flatten to a single font weight for wrapping simplicity. Bold/italic
  // markers still affect the flattened string content users typed.
  const text = flattenRuns(runs);
  const hasBold = runs.some((run) => run.kind === "bold");
  const hasItalic = runs.some((run) => run.kind === "italic");
  let font = cursor.fonts.regular;
  if (hasBold && hasItalic) font = cursor.fonts.boldItalic;
  else if (hasBold) font = cursor.fonts.bold;
  else if (hasItalic) font = cursor.fonts.italic;
  drawPlainLines(cursor, text, {
    size: options.size,
    font,
    indent: options.indent,
  });
}

function drawBlocks(cursor: DrawCursor, blocks: readonly Block[]): void {
  for (const block of blocks) {
    switch (block.kind) {
      case "heading": {
        const size = Math.max(22 - block.level * 2, 12);
        cursor.y -= 8;
        drawRuns(cursor, block.runs, { size });
        cursor.y -= 6;
        break;
      }
      case "paragraph":
        drawRuns(cursor, block.runs, { size: 11 });
        cursor.y -= 8;
        break;
      case "blockquote":
        drawRuns(cursor, block.runs, { size: 11, indent: 18 });
        cursor.y -= 8;
        break;
      case "code_block":
        drawPlainLines(cursor, block.text || " ", {
          size: 10,
          font: cursor.fonts.regular,
          indent: 12,
          color: rgb(0.25, 0.25, 0.25),
        });
        cursor.y -= 8;
        break;
      case "hr":
        ensureSpace(cursor, 16);
        cursor.page.drawLine({
          start: { x: MARGIN_X, y: cursor.y - 4 },
          end: { x: PAGE_WIDTH - MARGIN_X, y: cursor.y - 4 },
          thickness: 0.75,
          color: rgb(0.7, 0.7, 0.7),
        });
        cursor.y -= 16;
        break;
      case "ul":
        for (const item of block.items) {
          drawRuns(
            cursor,
            [{ kind: "text", text: "• " }, ...item],
            { size: 11, indent: 12 },
          );
        }
        cursor.y -= 6;
        break;
      case "ol":
        for (let i = 0; i < block.items.length; i += 1) {
          const item = block.items[i]!;
          drawRuns(
            cursor,
            [{ kind: "text", text: `${i + 1}. ` }, ...item],
            { size: 11, indent: 12 },
          );
        }
        cursor.y -= 6;
        break;
      default: {
        const _exhaustive: never = block;
        void _exhaustive;
        break;
      }
    }
  }
}

export function pdfExportBannerText(input: {
  warnings: readonly string[];
}): string | null {
  if (input.warnings.length === 0) return null;
  return PDF_EXPORT_LIMITS_BANNER;
}

/**
 * Export edited markdown as a valid text-centric PDF.
 */
export async function exportMarkdownToPdf({
  markdown,
}: ExportMarkdownToPdfArgs): Promise<PdfExportResult> {
  if (typeof markdown !== "string") {
    return { kind: "error", error: "Markdown must be a string." };
  }

  try {
    const doc = await PDFDocument.create();
    const fonts: FontSet = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    };
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const cursor: DrawCursor = {
      page,
      y: PAGE_HEIGHT - MARGIN_TOP,
      doc,
      fonts,
      replacedUnsupportedGlyphs: false,
    };

    const blocks = parseMarkdownBlocks(markdown);
    if (blocks.length === 0) {
      drawPlainLines(cursor, " ", { size: 11, font: fonts.regular });
    } else {
      drawBlocks(cursor, blocks);
    }

    const warnings: string[] = [
      PDF_EXPORT_FIDELITY_WARNING,
      PDF_EXPORT_LIMITS_BANNER,
    ];
    if (cursor.replacedUnsupportedGlyphs) {
      warnings.push(PDF_EXPORT_UNSUPPORTED_GLYPH_WARNING);
    }

    const saved = await doc.save();
    return {
      kind: "ok",
      bytes: new Uint8Array(saved),
      warnings,
    };
  } catch (error) {
    return {
      kind: "error",
      error:
        error instanceof Error
          ? error.message
          : "Planevo could not export this PDF.",
    };
  }
}
