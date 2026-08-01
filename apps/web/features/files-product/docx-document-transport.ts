export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocumentCheckpointReason =
  | "checkpoint"
  | "close"
  | "import"
  | "restore";

const CHECKPOINT_REASONS = new Set<DocumentCheckpointReason>([
  "checkpoint",
  "close",
  "import",
  "restore",
]);
const MAX_DOCX_ARCHIVE_ENTRIES = 2_048;
const MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export function buildDocxLoadRequest(input: { fileSourceId: string }): string {
  return `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document?content=docx`;
}

export function parseDocxResponseVersion(value: string | null): number | null {
  if (value === null || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) ? version : null;
}

export function shouldRetryDocxLoad(input: {
  status: number;
  retryHeader: string | null;
  hasRetried: boolean;
}): boolean {
  return (
    !input.hasRetried &&
    input.status === 409 &&
    input.retryHeader === "document-content-mismatch"
  );
}

/**
 * DOCX bodies stay opaque from the browser to Storage. Metadata travels in
 * headers so no byte can be coerced through JSON or a text decoder.
 */
export function buildDocxSaveRequest(input: {
  fileSourceId: string;
  baseVersion: number;
  content: Uint8Array;
  checkpointReason?: DocumentCheckpointReason;
}): { url: string; init: RequestInit } {
  if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new Error("A DOCX save requires a valid document version.");
  }

  return {
    url: `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document`,
    init: {
      method: "PUT",
      headers: {
        "content-type": DOCX_MIME_TYPE,
        "x-planevo-document-format": "docx",
        "x-planevo-document-version": String(input.baseVersion),
        "x-planevo-document-checkpoint": input.checkpointReason ?? "checkpoint",
      },
      body: input.content as unknown as BodyInit,
    },
  };
}

export function parseDocxSaveMetadata(
  headers: Pick<Headers, "get">,
): { baseVersion: number; checkpointReason: DocumentCheckpointReason } | null {
  if (
    headers.get("content-type")?.trim().toLowerCase() !== DOCX_MIME_TYPE ||
    headers.get("x-planevo-document-format") !== "docx"
  ) {
    return null;
  }

  const rawVersion = headers.get("x-planevo-document-version");
  const checkpointReason = headers.get("x-planevo-document-checkpoint") ?? "checkpoint";
  if (
    rawVersion === null ||
    !/^(0|[1-9]\d*)$/.test(rawVersion) ||
    !CHECKPOINT_REASONS.has(checkpointReason as DocumentCheckpointReason)
  ) {
    return null;
  }

  const baseVersion = Number(rawVersion);
  if (!Number.isSafeInteger(baseVersion)) return null;
  return {
    baseVersion,
    checkpointReason: checkpointReason as DocumentCheckpointReason,
  };
}

export function validateDocxBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 22) return false;

  const endOfDirectory = findZipEndOfCentralDirectory(bytes);
  if (!endOfDirectory) return false;
  const { centralDirectoryOffset, centralDirectorySize, entryCount } =
    endOfDirectory;
  if (entryCount === 0 || entryCount > MAX_DOCX_ARCHIVE_ENTRIES) return false;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.byteLength || centralDirectoryEnd > endOfDirectory.offset) {
    return false;
  }

  const names = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let cursor = centralDirectoryOffset;
  let cumulativeUncompressedBytes = 0;
  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > centralDirectoryEnd) return false;
      if (readUint32(bytes, cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
        return false;
      }
      const flags = readUint16(bytes, cursor + 8);
      const compressionMethod = readUint16(bytes, cursor + 10);
      const compressedSize = readUint32(bytes, cursor + 20);
      const uncompressedSize = readUint32(bytes, cursor + 24);
      const filenameLength = readUint16(bytes, cursor + 28);
      const extraLength = readUint16(bytes, cursor + 30);
      const commentLength = readUint16(bytes, cursor + 32);
      const localHeaderOffset = readUint32(bytes, cursor + 42);
      const entryEnd = cursor + 46 + filenameLength + extraLength + commentLength;
      if (entryEnd > centralDirectoryEnd) return false;
      if (
        (flags & 0x0001) !== 0 ||
        (flags & 0x0040) !== 0 ||
        (compressionMethod !== 0 && compressionMethod !== 8)
      ) {
        return false;
      }

      const name = decoder.decode(
        bytes.subarray(cursor + 46, cursor + 46 + filenameLength),
      );
      if (
        !name ||
        name.includes("\0") ||
        name.startsWith("/") ||
        name.split("/").some((segment) => segment === "..") ||
        names.has(name)
      ) {
        return false;
      }
      names.add(name);

      const localEntry = localFileEntry(bytes, localHeaderOffset);
      // APPNOTE does not require the full GP-flag word to match; only bit 0
      // (encrypted) and bit 3 (data descriptor) change how entry bytes are read.
      // Reject local-only encryption too — central already gates bit 0 / 0x0040.
      if (
        localEntry === null ||
        (localEntry.flags & 0x0001) !== 0 ||
        (localEntry.flags & 0x0040) !== 0 ||
        (localEntry.flags & 0x0009) !== (flags & 0x0009) ||
        localEntry.compressionMethod !== compressionMethod ||
        localEntry.filenameLength !== filenameLength ||
        localEntry.dataOffset + compressedSize > bytes.byteLength
      ) {
        return false;
      }
      const localName = decoder.decode(
        bytes.subarray(localEntry.nameOffset, localEntry.nameOffset + filenameLength),
      );
      if (localName !== name) return false;
      if (
        (flags & 0x0008) === 0 &&
        (localEntry.compressedSize !== compressedSize ||
          localEntry.uncompressedSize !== uncompressedSize)
      ) {
        return false;
      }
      cumulativeUncompressedBytes += uncompressedSize;
      if (cumulativeUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
        return false;
      }
      cursor = entryEnd;
    }
  } catch {
    return false;
  }

  return (
    cursor === centralDirectoryEnd &&
    names.has("[Content_Types].xml") &&
    names.has("word/document.xml")
  );
}

function findZipEndOfCentralDirectory(bytes: Uint8Array): {
  offset: number;
  centralDirectoryOffset: number;
  centralDirectorySize: number;
  entryCount: number;
} | null {
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = readUint16(bytes, offset + 20);
    if (offset + 22 + commentLength !== bytes.byteLength) continue;
    const diskNumber = readUint16(bytes, offset + 4);
    const centralDirectoryDisk = readUint16(bytes, offset + 6);
    const entriesOnDisk = readUint16(bytes, offset + 8);
    const entryCount = readUint16(bytes, offset + 10);
    const centralDirectorySize = readUint32(bytes, offset + 12);
    const centralDirectoryOffset = readUint32(bytes, offset + 16);
    if (
      diskNumber !== 0 ||
      centralDirectoryDisk !== 0 ||
      entriesOnDisk !== entryCount ||
      entryCount === 0xffff ||
      centralDirectorySize === 0xffffffff ||
      centralDirectoryOffset === 0xffffffff
    ) {
      return null;
    }
    return { offset, centralDirectoryOffset, centralDirectorySize, entryCount };
  }
  return null;
}

function localFileEntry(
  bytes: Uint8Array,
  localHeaderOffset: number,
): {
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  nameOffset: number;
  filenameLength: number;
  dataOffset: number;
} | null {
  if (localHeaderOffset + 30 > bytes.byteLength) return null;
  if (readUint32(bytes, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) return null;
  const flags = readUint16(bytes, localHeaderOffset + 6);
  const compressionMethod = readUint16(bytes, localHeaderOffset + 8);
  const compressedSize = readUint32(bytes, localHeaderOffset + 18);
  const uncompressedSize = readUint32(bytes, localHeaderOffset + 22);
  const filenameLength = readUint16(bytes, localHeaderOffset + 26);
  const extraLength = readUint16(bytes, localHeaderOffset + 28);
  const nameOffset = localHeaderOffset + 30;
  const dataOffset = nameOffset + filenameLength + extraLength;
  if (dataOffset > bytes.byteLength) return null;
  return {
    flags,
    compressionMethod,
    compressedSize,
    uncompressedSize,
    nameOffset,
    filenameLength,
    dataOffset,
  };
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}
