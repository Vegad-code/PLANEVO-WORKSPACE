import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createDocxAutosaveCoordinator,
  DocxAutosaveConflictError,
  type DocxAutosaveSnapshot,
} from "@/lib/files/docx-autosave";
import type { MarkdownViewMode } from "@/lib/files/editor-prefs";

import { DocumentVersionConflictError } from "./document-client";
import {
  clearDocumentRecoveryDraft,
  writeDocumentRecoveryDraftStrict,
} from "./document-recovery";
import type { FileDocumentRepository } from "./document-repository";
import { describeDocxOpenError } from "./docx-document-content";
import { ImportedDocumentEditor } from "./imported-document-editor";
import {
  saveDocxCopy,
  saveDocxCopyToFiles,
  type DocxDownload,
  type DocxSaveCopyHandlers,
  type DocxSaveCopyInput,
} from "./docx-save-copy";
import {
  LocalMirrorConflictError,
  writeLocalMirror,
  type LocalMirrorStatus,
} from "./local-file-mirror";

type DocxSerializer = () => Promise<Uint8Array>;

const RECOVERY_IDLE_MS = 150;
const AUTOSAVE_IDLE_MS = 750;
const COPY_NOTICE_CLEAR_MS = 1800;

export type DocxFlushReason = "checkpoint" | "close";
export type DocxSaveCopyResult = "saved" | "downloaded" | "cancelled";

export type DocxCopyResult =
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };

export type DocxDocumentSaveState = {
  status: DocxAutosaveSnapshot["status"];
  error: string | null;
  version: number;
  savedLabel: string;
  savingLabel: string;
};

export type DocxDocumentEditorProps = {
  fileSourceId: string;
  fileName: string;
  initialBytes: Uint8Array;
  /** Markdown from panel `openDocxDocument` — thin pass-through to the shell. */
  initialMarkdown?: string;
  importWarnings?: readonly string[];
  initialVersion: number;
  repository: FileDocumentRepository;
  mirrorStatus?: LocalMirrorStatus | null;
  viewMode?: MarkdownViewMode;
  onReload: () => void;
  onSaveStateChange?: (state: DocxDocumentSaveState) => void;
  onFlushReady?: (
    flush: ((reason: DocxFlushReason) => Promise<void>) | null,
  ) => void;
  onSaveCopyReady?: (handlers: DocxSaveCopyHandlers | null) => void;
};

export function DocxDocumentEditor(props: DocxDocumentEditorProps) {
  return (
    <DocxDocumentEditorSession
      key={`${props.fileSourceId}:${props.initialVersion}`}
      {...props}
    />
  );
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: DocxSaveCopyInput["showSaveFilePicker"];
};

function downloadDocxCopy(copy: DocxDownload): void {
  const bytes = new Uint8Array(copy.bytes);
  const blob = new Blob([bytes.buffer], { type: copy.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = copy.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function DocxDocumentEditorSession({
  fileSourceId,
  fileName,
  initialBytes,
  initialMarkdown,
  importWarnings,
  initialVersion,
  repository,
  mirrorStatus = null,
  viewMode,
  onReload,
  onSaveStateChange,
  onFlushReady,
  onSaveCopyReady,
}: DocxDocumentEditorProps) {
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedBytesRef = useRef<Uint8Array | null>(null);
  const openErrorBannerRef = useRef<HTMLDivElement>(null);
  const saveFailureBannerRef = useRef<HTMLDivElement>(null);
  const mirrorStatusRef = useRef(mirrorStatus);
  mirrorStatusRef.current = mirrorStatus;
  const [serializer, setSerializer] = useState<DocxSerializer | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<DocxCopyResult | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [mirrorSaved, setMirrorSaved] = useState(false);
  const stableInitialBytes = useMemo(
    () => new Uint8Array(initialBytes),
    [initialBytes],
  );

  const savedLabel = useMemo(() => {
    if (repository.storageKind === "local") {
      return "Saved to the file on your computer";
    }
    if (mirrorStatus?.state === "connected" && mirrorSaved) {
      return "Saved to Planevo and your computer";
    }
    return "Saved to Planevo";
  }, [mirrorSaved, mirrorStatus?.state, repository.storageKind]);

  const savingLabel = useMemo(() => {
    if (repository.storageKind === "local") {
      return "Saving to the file on your computer…";
    }
    if (mirrorStatus?.state === "connected") {
      return "Saving to Planevo and your computer…";
    }
    return "Saving to Planevo…";
  }, [mirrorStatus?.state, repository.storageKind]);

  const serialize = useCallback(async (): Promise<Uint8Array> => {
    if (!serializer) {
      throw new Error("The DOCX editor is not ready yet.");
    }
    return new Uint8Array(await serializer());
  }, [serializer]);

  const serializeAndCache = useCallback(async (): Promise<Uint8Array> => {
    const bytes = await serialize();
    lastSerializedBytesRef.current = new Uint8Array(bytes);
    return bytes;
  }, [serialize]);

  const coordinator = useMemo(
    () =>
      createDocxAutosaveCoordinator({
        fileSourceId,
        initialVersion,
        serialize: serializeAndCache,
        save: async (content, baseVersion, reason) => {
          try {
            const result = await repository.save({
              format: "docx",
              content: new Uint8Array(content),
              baseVersion,
              checkpointReason: reason === "close" ? "close" : "checkpoint",
            });
            let nextMirrorSaved = false;
            let mirrorError = result.mirrorError ?? null;
            if (mirrorStatusRef.current?.state === "connected") {
              try {
                await writeLocalMirror(fileSourceId, new Uint8Array(content));
                nextMirrorSaved = true;
                mirrorError = null;
              } catch (cause) {
                nextMirrorSaved = false;
                mirrorError =
                  cause instanceof Error
                    ? cause.message
                    : "The computer file could not be updated.";
              }
            }
            setMirrorSaved(nextMirrorSaved);
            setSaveWarning(mirrorError);
            return { version: result.version };
          } catch (error) {
            if (
              error instanceof DocumentVersionConflictError ||
              error instanceof LocalMirrorConflictError
            ) {
              const message =
                error instanceof LocalMirrorConflictError
                  ? "The original DOCX changed outside Planevo. Reload it before editing further."
                  : "This DOCX changed somewhere else. Reload the saved version before editing further.";
              throw new DocxAutosaveConflictError(message);
            }
            throw error;
          }
        },
        writeRecovery: async (draft) => {
          // Strict: blocked storage / open failure / abort / quota must reject so
          // the coordinator never replaces the original DOCX without a draft.
          await writeDocumentRecoveryDraftStrict({
            fileSourceId: draft.fileSourceId,
            baseVersion: draft.baseVersion,
            content: new Uint8Array(draft.content),
            updatedAt: new Date().toISOString(),
          });
        },
        clearRecovery: async () => {
          await clearDocumentRecoveryDraft(fileSourceId);
        },
      }),
    [
      fileSourceId,
      initialVersion,
      repository,
      serializeAndCache,
    ],
  );
  const [snapshot, setSnapshot] = useState<DocxAutosaveSnapshot>(() =>
    coordinator.getSnapshot(),
  );

  const clearScheduledPersistence = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const refreshSnapshot = useCallback(() => {
    setSnapshot(coordinator.getSnapshot());
  }, [coordinator]);

  const flush = useCallback(
    async (reason: DocxFlushReason): Promise<void> => {
      clearScheduledPersistence();
      const beforeSave = coordinator.getSnapshot();
      if (
        beforeSave.status !== "saved" &&
        beforeSave.status !== "conflict"
      ) {
        setSnapshot({ ...beforeSave, status: "saving", error: null });
      }
      const pendingSave = coordinator.flush(reason);
      queueMicrotask(refreshSnapshot);
      await pendingSave;
      refreshSnapshot();
    },
    [clearScheduledPersistence, coordinator, refreshSnapshot],
  );

  const handleDocumentChange = useCallback(() => {
    setSaveWarning(null);
    coordinator.markChanged();
    refreshSnapshot();
    clearScheduledPersistence();
    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      void coordinator
        .captureRecovery()
        .catch(() => undefined)
        .finally(refreshSnapshot);
    }, RECOVERY_IDLE_MS);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void flush("checkpoint").catch(() => {
        refreshSnapshot();
      });
    }, AUTOSAVE_IDLE_MS);
  }, [
    clearScheduledPersistence,
    coordinator,
    flush,
    refreshSnapshot,
  ]);

  const handleSerializerReady = useCallback(
    (nextSerializer: DocxSerializer | null) => {
      setSerializer(() => nextSerializer);
      if (nextSerializer) setOpenError(null);
    },
    [],
  );

  const performSaveCopy = useCallback(async (): Promise<DocxSaveCopyResult> => {
    setCopyResult(null);
    try {
      const pickerWindow = window as SaveFilePickerWindow;
      const picker =
        typeof pickerWindow.showSaveFilePicker === "function"
          ? pickerWindow.showSaveFilePicker.bind(pickerWindow)
          : undefined;
      const result = await saveDocxCopy({
        suggestedName: fileName,
        serialize,
        showSaveFilePicker: picker,
        download: downloadDocxCopy,
      });
      if (result === "saved") {
        setCopyResult({ kind: "notice", message: "Copy saved" });
      } else if (result === "downloaded") {
        setCopyResult({ kind: "notice", message: "Copy downloaded" });
      }
      return result;
    } catch (error) {
      setCopyResult({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The DOCX copy could not be saved.",
      });
      throw error;
    }
  }, [fileName, serialize]);

  const saveCopyToFiles = useCallback(
    async (
      createInFiles: Parameters<DocxSaveCopyHandlers["saveToFiles"]>[0],
    ) => {
      setCopyResult(null);
      try {
        const result = await saveDocxCopyToFiles({
          suggestedName: fileName,
          serialize,
          createInFiles,
        });
        setCopyResult({
          kind: "notice",
          message: `Copy saved as ${result.fileName}`,
        });
        return result;
      } catch (error) {
        setCopyResult({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "The DOCX copy could not be saved to Files.",
        });
        throw error;
      }
    },
    [fileName, serialize],
  );

  const saveCopyHandlers = useMemo<DocxSaveCopyHandlers>(
    () => ({
      saveToComputer: performSaveCopy,
      saveToFiles: saveCopyToFiles,
    }),
    [performSaveCopy, saveCopyToFiles],
  );

  useEffect(() => {
    onSaveStateChange?.({
      ...snapshot,
      savedLabel,
      savingLabel,
    });
  }, [
    onSaveStateChange,
    savedLabel,
    savingLabel,
    snapshot,
  ]);

  useEffect(() => {
    onFlushReady?.(flush);
    return () => onFlushReady?.(null);
  }, [flush, onFlushReady]);

  useEffect(() => {
    onSaveCopyReady?.(saveCopyHandlers);
    return () => onSaveCopyReady?.(null);
  }, [onSaveCopyReady, saveCopyHandlers]);

  useEffect(() => {
    if (!copyResult || copyResult.kind !== "notice") return;
    const timer = window.setTimeout(() => setCopyResult(null), COPY_NOTICE_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [copyResult]);

  useEffect(() => {
    if (openError) {
      openErrorBannerRef.current?.focus();
    }
  }, [openError]);

  const hasSaveFailure =
    snapshot.status === "error" || snapshot.status === "conflict";

  useEffect(() => {
    if (hasSaveFailure) {
      saveFailureBannerRef.current?.focus();
    }
  }, [hasSaveFailure]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void flush("checkpoint").catch(() => {
          refreshSnapshot();
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush, refreshSnapshot]);

  useEffect(() => {
    // Best-effort: tab close may freeze the page before async work finishes.
    const softCloseFlush = () => {
      void flush("close").catch(() => {
        refreshSnapshot();
      });
    };
    const persistHiddenChanges = () => {
      if (document.visibilityState !== "hidden") return;
      // flush("close") already writes a recovery draft before touching the source.
      softCloseFlush();
    };
    const persistLeavingPage = () => {
      softCloseFlush();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      const status = coordinator.getSnapshot().status;
      if (status === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", persistHiddenChanges);
    window.addEventListener("pagehide", persistLeavingPage);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", persistHiddenChanges);
      window.removeEventListener("pagehide", persistLeavingPage);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [coordinator, flush, refreshSnapshot]);

  useEffect(() => {
    return () => {
      clearScheduledPersistence();
      // Panel close is authoritative; this is best-effort for SPA route changes.
      if (coordinator.getSnapshot().status === "saved") return;
      const cached = lastSerializedBytesRef.current;
      if (cached) {
        void writeDocumentRecoveryDraftStrict({
          fileSourceId,
          baseVersion: coordinator.getSnapshot().version,
          content: cached,
          updatedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
    };
  }, [clearScheduledPersistence, coordinator, fileSourceId]);

  return (
    <section
      aria-label={`${fileName} document editor`}
      className="flex min-h-0 flex-1 flex-col bg-transparent text-files-text"
    >
      {copyResult ? (
        <div className="flex min-h-10 items-center justify-end gap-3 border-b border-files-border bg-transparent px-3">
          <span
            role={copyResult.kind === "error" ? "alert" : "status"}
            aria-live={copyResult.kind === "error" ? "assertive" : "polite"}
            className="text-product-meta text-files-text-muted"
          >
            {copyResult.message}
          </span>
        </div>
      ) : null}

      {openError ? (
        <div
          ref={openErrorBannerRef}
          role="alert"
          tabIndex={-1}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-brick bg-brick-tint px-3 py-2 text-product-meta text-brick outline-none"
        >
          <span>{openError}</span>
          <button
            type="button"
            onClick={onReload}
            className="font-medium underline underline-offset-2"
          >
            Try opening again
          </button>
        </div>
      ) : null}

      {hasSaveFailure ? (
        <div
          ref={saveFailureBannerRef}
          role="alert"
          tabIndex={-1}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-brick bg-brick-tint px-3 py-2 text-product-meta text-brick outline-none"
        >
          <span>
            {snapshot.error ??
              (snapshot.status === "conflict"
                ? "The saved DOCX changed somewhere else."
                : "Planevo could not save this DOCX.")}
          </span>
          <span className="flex items-center gap-3">
            {snapshot.status === "conflict" ? (
              <button
                type="button"
                onClick={onReload}
                className="font-medium underline underline-offset-2"
              >
                Reload saved version
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void flush("checkpoint").catch(() => {
                    refreshSnapshot();
                  })
                }
                className="font-medium underline underline-offset-2"
              >
                Retry save
              </button>
            )}
          </span>
        </div>
      ) : saveWarning ? (
        <div
          role="alert"
          className="border-b border-files-border px-3 py-2 text-product-meta text-brick"
        >
          {saveWarning}
        </div>
      ) : null}

      {/* Must be a flex column: child shells use flex-1; a plain overflow-hidden
          wrapper leaves height content-sized and clips without a scroller. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ImportedDocumentEditor
          bytes={stableInitialBytes}
          fileName={fileName}
          initialMarkdown={initialMarkdown}
          importWarnings={importWarnings}
          viewMode={viewMode}
          onChange={handleDocumentChange}
          onError={(error) => {
            setOpenError(describeDocxOpenError(error));
          }}
          onSaveRequest={() =>
            void flush("checkpoint").catch(() => {
              refreshSnapshot();
            })
          }
          onSerializerReady={handleSerializerReady}
        />
      </div>
    </section>
  );
}

export { docxBytes } from "./docx-document-content";
