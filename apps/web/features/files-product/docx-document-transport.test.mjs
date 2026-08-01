import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCX_MIME_TYPE,
  buildDocxLoadRequest,
  buildDocxSaveRequest,
  parseDocxResponseVersion,
  parseDocxSaveMetadata,
  shouldRetryDocxLoad,
  validateDocxBytes,
} from "./docx-document-transport.ts";

const encoder = new TextEncoder();

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function storedZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const content = entry.content ?? new Uint8Array();
    const compressedSize = entry.compressedSize ?? content.byteLength;
    const uncompressedSize = entry.uncompressedSize ?? content.byteLength;
    const flags = entry.flags ?? (entry.encrypted ? 1 : 0);
    const localFlags = entry.localFlags ?? flags;
    const centralFlags = entry.centralFlags ?? flags;
    const local = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20),
      ...u16(localFlags),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressedSize),
      ...u32(uncompressedSize),
      ...u16(name.byteLength),
      ...u16(0),
      ...name,
      ...content,
    ]);
    locals.push(local);
    central.push(
      Uint8Array.from([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20),
        ...u16(20),
        ...u16(centralFlags),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(compressedSize),
        ...u32(uncompressedSize),
        ...u16(name.byteLength),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...name,
      ]),
    );
    offset += local.byteLength;
  }
  const centralSize = central.reduce((total, entry) => total + entry.byteLength, 0);
  const eocd = Uint8Array.from([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  const size = offset + centralSize + eocd.byteLength;
  const zip = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of [...locals, ...central, eocd]) {
    zip.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return zip;
}

test("builds a raw DOCX save request without serialising OOXML bytes as JSON", () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
  const request = buildDocxSaveRequest({
    fileSourceId: "file / one",
    baseVersion: 4,
    content: bytes,
    checkpointReason: "close",
  });

  assert.equal(
    request.url,
    "/api/product-files/file%20%2F%20one/document",
  );
  assert.equal(request.init.method, "PUT");
  assert.equal(request.init.body, bytes);
  assert.deepEqual(request.init.headers, {
    "content-type": DOCX_MIME_TYPE,
    "x-planevo-document-format": "docx",
    "x-planevo-document-version": "4",
    "x-planevo-document-checkpoint": "close",
  });
});

test("builds an authenticated raw DOCX load request without using an expiring preview URL", () => {
  assert.equal(
    buildDocxLoadRequest({ fileSourceId: "file / one" }),
    "/api/product-files/file%20%2F%20one/document?content=docx",
  );
});

test("accepts only canonical DOCX metadata headers", () => {
  const headers = new Headers({
    "content-type": DOCX_MIME_TYPE,
    "x-planevo-document-format": "docx",
    "x-planevo-document-version": "12",
    "x-planevo-document-checkpoint": "checkpoint",
  });

  assert.deepEqual(parseDocxSaveMetadata(headers), {
    baseVersion: 12,
    checkpointReason: "checkpoint",
  });
  assert.equal(
    parseDocxSaveMetadata(
      new Headers({
        "content-type": "application/json",
        "x-planevo-document-format": "docx",
        "x-planevo-document-version": "12",
      }),
    ),
    null,
  );
  assert.equal(
    parseDocxSaveMetadata(
      new Headers({
        "content-type": DOCX_MIME_TYPE,
        "x-planevo-document-format": "docx",
        "x-planevo-document-version": "12.5",
      }),
    ),
    null,
  );
});

test("accepts a bounded OOXML package with its required document parts", () => {
  assert.equal(
    validateDocxBytes(
      storedZip([
        { name: "[Content_Types].xml", content: encoder.encode("<Types />") },
        { name: "word/document.xml", content: encoder.encode("<w:document />") },
      ]),
    ),
    true,
  );
});

test("rejects ZIP-shaped payloads that cannot be opened as a DOCX package", () => {
  assert.equal(validateDocxBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false);
  assert.equal(
    validateDocxBytes(
      storedZip([{ name: "[Content_Types].xml", content: encoder.encode("<Types />") }]),
    ),
    false,
  );
  assert.equal(validateDocxBytes(new Uint8Array([0x3c, 0x68, 0x74, 0x6d])), false);
  assert.equal(validateDocxBytes(new Uint8Array()), false);
});

test("rejects encrypted DOCX packages and declared compression bombs", () => {
  assert.equal(
    validateDocxBytes(
      storedZip([
        { name: "[Content_Types].xml", encrypted: true },
        { name: "word/document.xml" },
      ]),
    ),
    false,
  );
  // Declared bombs still fail via the cumulative uncompressed-bytes cap
  // (per-entry ratio checks falsely reject ordinary Word docs).
  assert.equal(
    validateDocxBytes(
      storedZip([
        { name: "[Content_Types].xml" },
        {
          name: "word/document.xml",
          compressedSize: 1,
          uncompressedSize: 101 * 1024 * 1024,
          content: new Uint8Array([0]),
        },
      ]),
    ),
    false,
  );
});

test("accepts ordinary high-ratio OOXML packages above 250:1",
  () => {
  // Real Word docs routinely land at 288:1 / 332:1 on repetitive parts.
  // The server never inflates DOCX, so ratio is not a security bound.
  const compressedSize = 400;
  const uncompressedSize = compressedSize * 288;
  assert.ok(uncompressedSize / compressedSize > 250);
  assert.equal(
    validateDocxBytes(
      storedZip([
        { name: "[Content_Types].xml", content: encoder.encode("<Types />") },
        {
          name: "word/document.xml",
          compressedSize,
          uncompressedSize,
          content: new Uint8Array(compressedSize),
        },
      ]),
    ),
    true,
  );
});

test("rejects an archive whose local compression method disagrees with its directory", () => {
  const zip = storedZip([
    { name: "[Content_Types].xml", content: encoder.encode("<Types />") },
    { name: "word/document.xml", content: encoder.encode("<w:document />") },
  ]);
  // Local header compression method lives at offset 8 of the first entry.
  zip[8] = 9;
  zip[9] = 0;

  assert.equal(validateDocxBytes(zip), false);
});

test("accepts archives whose local and central GP flags differ outside 0x0009", () => {
  // Bit 11 (UTF-8) and bits 1-2 (deflate hint) are free to diverge per APPNOTE.
  assert.equal(
    validateDocxBytes(
      storedZip([
        {
          name: "[Content_Types].xml",
          content: encoder.encode("<Types />"),
          localFlags: 0x0800,
          centralFlags: 0x0000,
        },
        {
          name: "word/document.xml",
          content: encoder.encode("<w:document />"),
          localFlags: 0x0002,
          centralFlags: 0x0004,
        },
      ]),
    ),
    true,
  );
});

test("rejects encryption present only on the local file header", () => {
  assert.equal(
    validateDocxBytes(
      storedZip([
        {
          name: "[Content_Types].xml",
          content: encoder.encode("<Types />"),
          localFlags: 0x0001,
          centralFlags: 0x0000,
        },
        { name: "word/document.xml", content: encoder.encode("<w:document />") },
      ]),
    ),
    false,
  );
});

test("rejects when local and central disagree on data-descriptor bit 3", () => {
  assert.equal(
    validateDocxBytes(
      storedZip([
        {
          name: "[Content_Types].xml",
          content: encoder.encode("<Types />"),
          localFlags: 0x0008,
          centralFlags: 0x0000,
        },
        { name: "word/document.xml", content: encoder.encode("<w:document />") },
      ]),
    ),
    false,
  );
});

test("does not mistake a missing DOCX version response header for version zero", () => {
  assert.equal(parseDocxResponseVersion(null), null);
  assert.equal(parseDocxResponseVersion("4"), 4);
  assert.equal(parseDocxResponseVersion("04"), null);
  assert.equal(parseDocxResponseVersion("4.5"), null);
});

test("retries a descriptor and byte load once when the server detects a pointer swap", () => {
  assert.equal(
    shouldRetryDocxLoad({
      status: 409,
      retryHeader: "document-content-mismatch",
      hasRetried: false,
    }),
    true,
  );
  assert.equal(
    shouldRetryDocxLoad({
      status: 409,
      retryHeader: "document-content-mismatch",
      hasRetried: true,
    }),
    false,
  );
  assert.equal(
    shouldRetryDocxLoad({ status: 409, retryHeader: null, hasRetried: false }),
    false,
  );
});
