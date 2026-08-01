import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  PDF_MIME_TYPE,
  buildPdfLoadRequest,
  buildPdfSaveRequest,
  parsePdfResponseVersion,
  parsePdfSaveMetadata,
  pdfBytesDeclareEncryption,
  shouldRetryPdfLoad,
  validatePdfBytes,
  validatePdfSaveBytes,
} from "./pdf-document-transport.ts";

async function minimalPdfBytes() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("ok", { x: 20, y: 100, size: 12, font });
  return new Uint8Array(await doc.save());
}

/**
 * Classic (non-xref-stream) PDF so tests can splice trailer/xref cheaply.
 * `extraTrailerKeys` lands in the trailer dict (e.g. `/Encrypt 4 0 R`).
 */
function buildClassicPdf(input = {}) {
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>endobj\n",
  ];
  if (input.extraTrailerKeys?.includes("/Encrypt")) {
    objects.push(
      "4 0 obj<< /Filter /Standard /V 1 /R 2 /Length 40 /P -4 >>endobj\n",
    );
  }

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer<< /Size ${objects.length + 1} /Root 1 0 R${
    input.extraTrailerKeys ? ` ${input.extraTrailerKeys}` : ""
  } >>\n`;
  const startxrefValue = input.startxrefOverride ?? xrefStart;
  return new TextEncoder().encode(
    `${body}${xref}${trailer}startxref\n${startxrefValue}\n%%EOF\n`,
  );
}

test("builds an authenticated raw PDF load request without using an expiring preview URL", () => {
  assert.equal(
    buildPdfLoadRequest({ fileSourceId: "file / one" }),
    "/api/product-files/file%20%2F%20one/document?content=pdf",
  );
});

test("builds a raw PDF save request without serialising PDF bytes as JSON", async () => {
  const content = await minimalPdfBytes();
  const request = buildPdfSaveRequest({
    fileSourceId: "file / one",
    baseVersion: 3,
    content,
    checkpointReason: "close",
  });

  assert.equal(
    request.url,
    "/api/product-files/file%20%2F%20one/document",
  );
  assert.equal(request.init.method, "PUT");
  assert.equal(request.init.body, content);
  assert.deepEqual(request.init.headers, {
    "content-type": PDF_MIME_TYPE,
    "x-planevo-document-format": "pdf",
    "x-planevo-document-version": "3",
    "x-planevo-document-checkpoint": "close",
  });
});

test("rejects an invalid PDF save version before the request is built", () => {
  assert.throws(
    () =>
      buildPdfSaveRequest({
        fileSourceId: "file-1",
        baseVersion: -1,
        content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      }),
    /valid document version/,
  );
});

test("accepts only canonical PDF metadata headers", () => {
  const headers = new Headers({
    "content-type": PDF_MIME_TYPE,
    "x-planevo-document-format": "pdf",
    "x-planevo-document-version": "2",
    "x-planevo-document-checkpoint": "checkpoint",
  });
  assert.deepEqual(parsePdfSaveMetadata(headers), {
    baseVersion: 2,
    checkpointReason: "checkpoint",
  });

  assert.equal(
    parsePdfSaveMetadata(
      new Headers({
        "content-type": "application/json",
        "x-planevo-document-format": "pdf",
        "x-planevo-document-version": "2",
      }),
    ),
    null,
  );
  assert.equal(
    parsePdfSaveMetadata(
      new Headers({
        "content-type": "application/pdf-evil",
        "x-planevo-document-format": "pdf",
        "x-planevo-document-version": "2",
      }),
    ),
    null,
    "prefix spoof of application/pdf must not parse as PDF",
  );
  assert.equal(
    parsePdfSaveMetadata(
      new Headers({
        "content-type": `${PDF_MIME_TYPE}; charset=binary`,
        "x-planevo-document-format": "pdf",
        "x-planevo-document-version": "2",
      }),
    ),
    null,
  );
  assert.equal(
    parsePdfSaveMetadata(
      new Headers({
        "content-type": PDF_MIME_TYPE,
        "x-planevo-document-format": "pdf",
        "x-planevo-document-version": "12.5",
      }),
    ),
    null,
  );
});

test("does not mistake a missing PDF version response header for version zero", () => {
  assert.equal(parsePdfResponseVersion(null), null);
  assert.equal(parsePdfResponseVersion("0"), 0);
  assert.equal(parsePdfResponseVersion("12"), 12);
  assert.equal(parsePdfResponseVersion("01"), null);
  assert.equal(parsePdfResponseVersion("-1"), null);
  assert.equal(parsePdfResponseVersion("4.5"), null);
});

test("retries a descriptor and byte load once when the server detects a pointer swap", () => {
  assert.equal(
    shouldRetryPdfLoad({
      status: 409,
      retryHeader: "document-content-mismatch",
      hasRetried: false,
    }),
    true,
  );
  assert.equal(
    shouldRetryPdfLoad({
      status: 409,
      retryHeader: "document-content-mismatch",
      hasRetried: true,
    }),
    false,
  );
  assert.equal(
    shouldRetryPdfLoad({
      status: 500,
      retryHeader: "document-content-mismatch",
      hasRetried: false,
    }),
    false,
  );
  assert.equal(
    shouldRetryPdfLoad({ status: 409, retryHeader: null, hasRetried: false }),
    false,
  );
});

test("validatePdfBytes accepts a real PDF and rejects garbage", async () => {
  const bytes = await minimalPdfBytes();
  assert.equal(validatePdfBytes(bytes), true);
  assert.equal(validatePdfBytes(new Uint8Array([1, 2, 3, 4])), false);
  assert.equal(validatePdfBytes(new Uint8Array()), false);
  assert.equal(
    validatePdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])),
    false,
  );

  const missingEof = new Uint8Array(bytes.byteLength);
  missingEof.set(bytes);
  // Overwrite the tail so %%EOF disappears.
  missingEof.fill(0x20, Math.max(0, missingEof.byteLength - 32));
  assert.equal(validatePdfBytes(missingEof), false);
});

test("validatePdfBytes rejects header-only forgeries that only mimic magic and %%EOF", () => {
  const forgery = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
  assert.equal(validatePdfBytes(forgery), false);

  const forgeryWithRoot = new TextEncoder().encode(
    "%PDF-1.4\n%%EOF\n/Root 1 0 R\n",
  );
  assert.equal(validatePdfBytes(forgeryWithRoot), false);
});

test("validatePdfBytes rejects truncated xref tables whose startxref points past the file", () => {
  const truncated = buildClassicPdf({ startxrefOverride: 9_999_999 });
  assert.equal(validatePdfBytes(truncated), false);

  const missingXrefTarget = new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\nstartxref\n99999\n%%EOF\n",
  );
  assert.equal(validatePdfBytes(missingXrefTarget), false);
});

test("validatePdfBytes accepts classic xref tables and rejects oversize or object bombs", () => {
  const classic = buildClassicPdf();
  assert.equal(validatePdfBytes(classic), true);

  assert.equal(
    validatePdfBytes(classic, { maxBytes: classic.byteLength - 1 }),
    false,
  );
  assert.equal(validatePdfBytes(classic, { maxObjects: 0 }), false);
  assert.equal(validatePdfBytes(classic, { maxPages: 0 }), false);
});

test("validatePdfSaveBytes rejects encrypted PDFs while structural validate still accepts them for preview", () => {
  const encrypted = buildClassicPdf({
    extraTrailerKeys: "/Encrypt 4 0 R",
  });
  assert.equal(pdfBytesDeclareEncryption(encrypted), true);
  assert.equal(validatePdfBytes(encrypted), true);
  assert.equal(validatePdfSaveBytes(encrypted), false);
  assert.equal(
    validatePdfBytes(encrypted, { rejectEncrypted: true }),
    false,
  );

  const plain = buildClassicPdf();
  assert.equal(pdfBytesDeclareEncryption(plain), false);
  assert.equal(validatePdfSaveBytes(plain), true);
});

test("buildPdfSaveRequest rejects encrypted and structurally invalid PDF bodies", () => {
  const encrypted = buildClassicPdf({
    extraTrailerKeys: "/Encrypt 4 0 R",
  });
  assert.throws(
    () =>
      buildPdfSaveRequest({
        fileSourceId: "file-1",
        baseVersion: 1,
        content: encrypted,
      }),
    /Encrypted PDFs cannot be saved/,
  );

  assert.throws(
    () =>
      buildPdfSaveRequest({
        fileSourceId: "file-1",
        baseVersion: 1,
        content: new TextEncoder().encode("%PDF-1.4\n%%EOF\n"),
      }),
    /structurally valid PDF/,
  );
});
