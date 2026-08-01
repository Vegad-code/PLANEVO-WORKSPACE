import { suggestedDocxCopyName } from "./docx-document-content.ts";

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocxSavePickerOptions = {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
};

export type DocxWritable = {
  write: (content: ArrayBuffer) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
};

export type DocxSaveHandle = {
  createWritable: () => Promise<DocxWritable>;
};

export type DocxDownload = {
  bytes: Uint8Array;
  fileName: string;
  contentType: typeof DOCX_CONTENT_TYPE;
};

export type DocxSaveCopyInput = {
  suggestedName: string;
  serialize: () => Promise<Uint8Array>;
  showSaveFilePicker?: (
    options: DocxSavePickerOptions,
  ) => Promise<DocxSaveHandle>;
  download: (copy: DocxDownload) => void | Promise<void>;
};

export type DocxFilesCopyResult = {
  fileSourceId: string;
  fileName: string;
};

export type DocxSaveCopyToFilesInput = {
  suggestedName: string;
  serialize: () => Promise<Uint8Array>;
  createInFiles: (copy: DocxDownload) => Promise<DocxFilesCopyResult>;
};

export type DocxSaveCopyHandlers = {
  saveToComputer: () => Promise<"saved" | "downloaded" | "cancelled">;
  saveToFiles: (
    createInFiles: DocxSaveCopyToFilesInput["createInFiles"],
  ) => Promise<DocxFilesCopyResult>;
};

/** Regression guard: a Files copy must never reuse the open file's id. */
export function assertDocxCopyUsesDistinctFileSource(input: {
  sourceFileSourceId: string;
  createdFileSourceId: string;
}): void {
  if (input.createdFileSourceId === input.sourceFileSourceId) {
    throw new Error(
      "DOCX copy must create a new Files entry; the original must stay open.",
    );
  }
}

export function encodeDocxBytesBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

export function decodeDocxBytesBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function saveDocxCopyToFiles(
  input: DocxSaveCopyToFilesInput,
): Promise<DocxFilesCopyResult> {
  const fileName = suggestedDocxCopyName(input.suggestedName);
  const bytes = new Uint8Array(await input.serialize());
  return input.createInFiles({
    bytes,
    fileName,
    contentType: DOCX_CONTENT_TYPE,
  });
}

export async function saveDocxCopy(
  input: DocxSaveCopyInput,
): Promise<"saved" | "downloaded" | "cancelled"> {
  const fileName = suggestedDocxCopyName(input.suggestedName);

  if (!input.showSaveFilePicker) {
    const bytes = new Uint8Array(await input.serialize());
    await input.download({
      bytes,
      fileName,
      contentType: DOCX_CONTENT_TYPE,
    });
    return "downloaded";
  }

  let handle: DocxSaveHandle;
  try {
    // This call intentionally happens before the first await in the click path:
    // browsers require the native picker to retain the user's activation.
    const pickerRequest = input.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "Word document",
          accept: {
            [DOCX_CONTENT_TYPE]: [".docx"],
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
