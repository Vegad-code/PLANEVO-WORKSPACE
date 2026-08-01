/**
 * Structural PDF checks shared by transport, fidelity, and save paths.
 * Depth matches DOCX transport validation for the PDF domain: openable
 * package shape, bounds, caps, and encryption — not layout fidelity.
 */

/** Soft ceiling aligned with DOCX's 100 MiB uncompressed bomb guard. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
/** Cheap object-count bomb guard (plaintext `N 0 obj` markers). */
export const MAX_PDF_OBJECTS = 500_000;
/**
 * Upper bound on plaintext `/Type /Page` markers. Modern PDFs often keep
 * page dicts inside object streams, so a count of 0 is allowed.
 */
export const MAX_PDF_PAGES = 10_000;

const HEADER_SCAN_LIMIT = 1024;
const EOF_TAIL_SCAN = 1024;
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46] as const; // %PDF

export type ValidatePdfBytesOptions = {
  /** When true, reject packages that declare an /Encrypt dictionary. */
  rejectEncrypted?: boolean;
  maxBytes?: number;
  maxObjects?: number;
  maxPages?: number;
};

export function findPdfHeaderOffset(bytes: Uint8Array): number | null {
  const limit = Math.min(bytes.byteLength - 4, HEADER_SCAN_LIMIT);
  for (let i = 0; i <= limit; i += 1) {
    if (
      bytes[i] === PDF_HEADER[0] &&
      bytes[i + 1] === PDF_HEADER[1] &&
      bytes[i + 2] === PDF_HEADER[2] &&
      bytes[i + 3] === PDF_HEADER[3]
    ) {
      return i;
    }
  }
  return null;
}

/**
 * True when the PDF trailer / xref dictionary declares /Encrypt.
 * Stream bodies are stripped first so compressed page content cannot forge it.
 */
export function pdfBytesDeclareEncryption(bytes: Uint8Array): boolean {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) return false;
  const headerOffset = findPdfHeaderOffset(bytes);
  if (headerOffset === null) return false;
  const decoder = new TextDecoder("latin1");
  const body = decoder.decode(bytes.subarray(headerOffset));
  const withoutStreams = body.replace(/\bstream\r?\n[\s\S]*?\bendstream\b/g, "");
  return /\/Encrypt(?![A-Za-z0-9])/.test(withoutStreams);
}

/**
 * Structural openability gate for PDF packages.
 * Rejects header-only forgeries, truncated xref tables, oversize bombs, and
 * (optionally) encrypted packages. Does not claim layout fidelity.
 */
export function validatePdfBytes(
  bytes: Uint8Array,
  options: ValidatePdfBytesOptions = {},
): boolean {
  if (!(bytes instanceof Uint8Array)) return false;

  const maxBytes = options.maxBytes ?? MAX_PDF_BYTES;
  const maxObjects = options.maxObjects ?? MAX_PDF_OBJECTS;
  const maxPages = options.maxPages ?? MAX_PDF_PAGES;

  if (bytes.byteLength < 15 || bytes.byteLength > maxBytes) return false;

  const headerOffset = findPdfHeaderOffset(bytes);
  if (headerOffset === null) return false;

  // Version must look like %PDF-N.M (ISO 32000).
  if (!hasPdfVersion(bytes, headerOffset)) return false;

  const decoder = new TextDecoder("latin1");
  const eofOffset = findLastPdfEof(bytes);
  if (eofOffset === null || eofOffset < headerOffset) return false;

  const startxref = findLastStartxref(bytes, headerOffset, eofOffset);
  if (startxref === null) return false;

  const xrefPos = resolveXrefPosition({
    bytes,
    headerOffset,
    startxrefOffset: startxref.offset,
  });
  if (xrefPos === null) return false;

  const bodyText = decoder.decode(bytes.subarray(headerOffset, eofOffset));
  const objectCount = countPdfObjects(bodyText);
  if (objectCount < 1 || objectCount > maxObjects) return false;

  const pageCount = countPdfPages(bodyText);
  if (pageCount > maxPages) return false;

  // Catalog pointer must appear in plaintext (trailer or xref-stream dict).
  if (!/\/Root(?![A-Za-z0-9])/.test(bodyText)) return false;

  if (options.rejectEncrypted && pdfBytesDeclareEncryption(bytes)) {
    return false;
  }

  return true;
}

/**
 * Save-path gate: structurally openable and not password-encrypted.
 * Encrypted PDFs remain loadable for preview-only; saves must not persist them.
 */
export function validatePdfSaveBytes(bytes: Uint8Array): boolean {
  return validatePdfBytes(bytes, { rejectEncrypted: true });
}

function hasPdfVersion(bytes: Uint8Array, headerOffset: number): boolean {
  // %PDF-1.7
  if (headerOffset + 8 > bytes.byteLength) return false;
  if (bytes[headerOffset + 4] !== 0x2d) return false; // -
  const major = bytes[headerOffset + 5];
  const dot = bytes[headerOffset + 6];
  const minor = bytes[headerOffset + 7];
  return (
    major >= 0x30 &&
    major <= 0x39 &&
    dot === 0x2e &&
    minor >= 0x30 &&
    minor <= 0x39
  );
}

function findLastPdfEof(bytes: Uint8Array): number | null {
  const scanFrom = Math.max(0, bytes.byteLength - EOF_TAIL_SCAN);
  const decoder = new TextDecoder("latin1");
  const tail = decoder.decode(bytes.subarray(scanFrom));
  let lastIndex = -1;
  const global = /%%EOF/g;
  let next: RegExpExecArray | null;
  while ((next = global.exec(tail)) !== null) {
    lastIndex = next.index;
  }
  if (lastIndex < 0) return null;
  return scanFrom + lastIndex;
}

function findLastStartxref(
  bytes: Uint8Array,
  headerOffset: number,
  eofOffset: number,
): { offset: number; position: number } | null {
  const decoder = new TextDecoder("latin1");
  const region = decoder.decode(bytes.subarray(headerOffset, eofOffset));
  const marker = "startxref";
  const markerAt = region.lastIndexOf(marker);
  if (markerAt < 0) return null;

  const afterMarker = region.slice(markerAt + marker.length);
  const offsetMatch = /^\s+(\d+)\s*/.exec(afterMarker);
  if (!offsetMatch) return null;

  return {
    offset: Number(offsetMatch[1]),
    position: headerOffset + markerAt,
  };
}

function resolveXrefPosition(input: {
  bytes: Uint8Array;
  headerOffset: number;
  startxrefOffset: number;
}): number | null {
  const { bytes, headerOffset, startxrefOffset } = input;
  if (!Number.isSafeInteger(startxrefOffset) || startxrefOffset < 0) {
    return null;
  }

  // Spec offsets are from file start (including leading junk). Readers that
  // skip junk also author bodies with offsets relative to %PDF — accept both.
  const candidates = [startxrefOffset, headerOffset + startxrefOffset];
  for (const candidate of candidates) {
    if (candidate < headerOffset || candidate >= bytes.byteLength) continue;
    if (looksLikeXrefSection(bytes, candidate)) return candidate;
  }
  return null;
}

function looksLikeXrefSection(bytes: Uint8Array, offset: number): boolean {
  const decoder = new TextDecoder("latin1");
  const probe = decoder.decode(
    bytes.subarray(offset, Math.min(bytes.byteLength, offset + 64)),
  );
  if (/^\s*xref\b/.test(probe)) return true;
  // Cross-reference stream: `N G obj` then a dict with /Type /XRef (maybe later).
  return /^\s*\d+\s+\d+\s+obj\b/.test(probe);
}

function countPdfObjects(bodyText: string): number {
  const matches = bodyText.match(/\b\d+\s+\d+\s+obj\b/g);
  return matches?.length ?? 0;
}

function countPdfPages(bodyText: string): number {
  // `/Type /Pages` (tree node) must not count; only leaf `/Type /Page`.
  const matches = bodyText.match(/\/Type\s*\/Page(?![sA-Za-z0-9])/g);
  return matches?.length ?? 0;
}
