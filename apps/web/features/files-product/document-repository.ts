"use client";

import type { DocumentFormat } from "@planevo/core/files/document-descriptor";
import type { FileStorageKind } from "@planevo/core/types/files";
import {
  loadFileDocument,
  restoreFileDocumentRevision,
  saveFileDocument,
  updateFileDocumentSidebar,
  type FileDocumentSaveResult,
  type LoadedFileDocument,
  type TextDocumentMetadata,
} from "./document-client";
import type { ProductFileItem } from "./files-table";
import {
  loadLocalFileDocument,
  restoreLocalFileRevision,
  saveLocalFileDocument,
  saveLocalFileNote,
} from "./local-file-repository";

type RepositorySaveInput = {
  format: DocumentFormat;
  baseVersion: number;
  content: unknown;
  textMetadata?: TextDocumentMetadata;
  checkpointReason?: "checkpoint" | "close" | "import" | "restore";
};

export type FileDocumentRepository = {
  storageKind: FileStorageKind;
  load: (signal?: AbortSignal) => Promise<LoadedFileDocument>;
  save: (input: RepositorySaveInput) => Promise<FileDocumentSaveResult>;
  saveNote: (content: string) => Promise<boolean>;
  restoreRevision: (
    revisionId: string,
    baseVersion: number,
  ) => Promise<void>;
};

export function documentRepositoryFor(
  file: Pick<
    ProductFileItem,
    "id" | "storage_kind" | "name" | "mime_type"
  >,
): FileDocumentRepository {
  if (file.storage_kind === "local") {
    return {
      storageKind: "local",
      load: () => loadLocalFileDocument(file),
      save: (input) => {
        if (typeof input.content !== "string") {
          throw new Error("Local files require exact text content.");
        }
        return saveLocalFileDocument({
          fileSourceId: file.id,
          baseVersion: input.baseVersion,
          content: input.content,
          textMetadata: input.textMetadata ?? {
            hasUtf8Bom: false,
            newline: "lf",
            trailingNewline: input.content.endsWith("\n"),
          },
          checkpointReason:
            input.checkpointReason === "close" ? "close" : "checkpoint",
        });
      },
      saveNote: (content) => saveLocalFileNote(file.id, content),
      restoreRevision: (revisionId) =>
        restoreLocalFileRevision(file.id, revisionId),
    };
  }

  return {
    storageKind: file.storage_kind,
    load: (signal) => loadFileDocument(file.id, signal),
    save: (input) =>
      saveFileDocument({
        fileSourceId: file.id,
        ...input,
      }),
    saveNote: async (content) => {
      try {
        await updateFileDocumentSidebar(file.id, {
          action: "save-note",
          content,
        });
        return true;
      } catch {
        return false;
      }
    },
    restoreRevision: async (revisionId, baseVersion) => {
      await restoreFileDocumentRevision(file.id, revisionId, baseVersion);
    },
  };
}
