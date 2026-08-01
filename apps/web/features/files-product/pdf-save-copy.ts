import { suggestedPdfCopyName } from "./pdf-document-content.ts";

export const PDF_CONTENT_TYPE = "application/pdf";

export type PdfSavePickerOptions = {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};

export type PdfWritable = {
  write: (content: ArrayBuffer) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
};

export type PdfSaveHandle = {
  createWritable: () => Promise<PdfWritable>;
};

export type PdfDownload = {
  bytes: Uint8Array;
  fileName: string;
  contentType: typeof PDF_CONTENT_TYPE;
};

export type PdfSaveCopyInput = {
  suggestedName: string;
  serialize: () => Promise<Uint8Array>;
  showSaveFilePicker?: (
    options: PdfSavePickerOptions,
  ) => Promise<PdfSaveHandle>;
  download: (copy: PdfDownload) => void | Promise<void>;
};

export type PdfFilesCopyResult = {
  fileSourceId: string;
  fileName: string;
};

export type PdfSaveCopyToFilesInput = {
  suggestedName: string;
  serialize: () => Promise<Uint8Array>;
  createInFiles: (copy: PdfDownload) => Promise<PdfFilesCopyResult>;
};

export type PdfSaveCopyHandlers = {
  saveToComputer: () => Promise<"saved" | "downloaded" | "cancelled">;
  saveToFiles: (
    createInFiles: PdfSaveCopyToFilesInput["createInFiles"],
  ) => Promise<PdfFilesCopyResult>;
};

/** Honest preview-only copy for scanned / non-text PDFs (save-a-copy = PDF bytes). */
export const PDF_PREVIEW_ONLY_BANNER =
  "This PDF has no editable text. Preview only — use Save a copy to keep a separate PDF on your computer or in Planevo Files.";

const LEGACY_PREVIEW_ONLY_BANNER =
  "This PDF has no editable text. Use Save a copy to create a Planevo markdown document.";

/** Normalizes upstream banner copy that still promises markdown conversion. */
export function resolvePdfPreviewOnlyBanner(
  banner: string | null | undefined,
): string | null {
  if (!banner) return PDF_PREVIEW_ONLY_BANNER;
  if (banner === LEGACY_PREVIEW_ONLY_BANNER) return PDF_PREVIEW_ONLY_BANNER;
  return banner;
}

export type PdfSaveCopyHandlersFromBytesInput = {
  fileName: string;
  bytes: Uint8Array;
  showSaveFilePicker?: PdfSaveCopyInput["showSaveFilePicker"];
  download: PdfSaveCopyInput["download"];
};

/** Preview-only PDFs have no editor serializer — copy the loaded source bytes. */
export function createPdfSaveCopyHandlersFromBytes(
  input: PdfSaveCopyHandlersFromBytesInput,
): PdfSaveCopyHandlers {
  const stableBytes = new Uint8Array(input.bytes);
  const serialize = async () => new Uint8Array(stableBytes);

  return {
    saveToComputer: () =>
      savePdfCopy({
        suggestedName: input.fileName,
        serialize,
        showSaveFilePicker: input.showSaveFilePicker,
        download: input.download,
      }),
    saveToFiles: (createInFiles) =>
      savePdfCopyToFiles({
        suggestedName: input.fileName,
        serialize,
        createInFiles,
      }),
  };
}

/** Regression guard: a Files copy must never reuse the open file's id. */
export function assertPdfCopyUsesDistinctFileSource(input: {
  sourceFileSourceId: string;
  createdFileSourceId: string;
}): void {
  if (input.createdFileSourceId === input.sourceFileSourceId) {
    throw new Error(
      "PDF copy must create a new Files entry; the original must stay open.",
    );
  }
}

export function encodePdfBytesBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

export function decodePdfBytesBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function savePdfCopyToFiles(
  input: PdfSaveCopyToFilesInput,
): Promise<PdfFilesCopyResult> {
  const fileName = suggestedPdfCopyName(input.suggestedName);
  const bytes = new Uint8Array(await input.serialize());
  return input.createInFiles({
    bytes,
    fileName,
    contentType: PDF_CONTENT_TYPE,
  });
}

export async function savePdfCopy(
  input: PdfSaveCopyInput,
): Promise<"saved" | "downloaded" | "cancelled"> {
  const fileName = suggestedPdfCopyName(input.suggestedName);

  if (!input.showSaveFilePicker) {
    const bytes = new Uint8Array(await input.serialize());
    await input.download({
      bytes,
      fileName,
      contentType: PDF_CONTENT_TYPE,
    });
    return "downloaded";
  }

  let handle: PdfSaveHandle;
  try {
    // This call intentionally happens before the first await in the click path:
    // browsers require the native picker to retain the user's activation.
    const pickerRequest = input.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "PDF document",
          accept: {
            [PDF_CONTENT_TYPE]: [".pdf"],
          },
        },
      ],
    });
    handle = await pickerRequest;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "cancelled";
    }
    throw error;
  }

  const bytes = new Uint8Array(await input.serialize());
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes.buffer);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
  return "saved";
}
