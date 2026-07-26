"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
} from "lucide-react";
import type { PlanevoPartialBlock } from "@/features/editor/schema";
import { encodeEditableText } from "@planevo/core/files/text-roundtrip";
import { Badge } from "@/components/ui/badge";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import {
  MAX_PREVIEW_WIDTH,
  MIN_PREVIEW_WIDTH,
  getPreviewWidth,
  setPreviewWidth,
} from "@/lib/files/preview-prefs";
import { formatBytes } from "./storage-meter";
import { importProductDocumentAction } from "@/app/(workspace)/files/actions";
import { toast } from "@/components/ui/toast";
import {
  loadFileDocument,
  restoreFileDocumentRevision,
  saveFileDocument,
  updateFileDocumentSidebar,
  type LoadedFileDocument,
} from "./document-client";
import {
  clearDocumentRecoveryDraft,
  readDocumentRecoveryDraft,
  writeDocumentRecoveryDraft,
} from "./document-recovery";
import type { ProductFileItem } from "./files-table";
import { useAutosaveField } from "./use-autosave-field";
import { useDocumentAutosave } from "./use-document-autosave";
import {
  connectLocalMirror,
  forgetLocalMirror,
  localMirrorStatus,
  reconnectLocalMirror,
  writeLocalMirror,
  type LocalMirrorStatus,
} from "./local-file-mirror";

const LazyPlanevoEditor = dynamic(
  () =>
    import("@/features/editor/planevo-editor").then(
      (module) => module.PlanevoEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-product-body text-files-text-muted">
        Loading editor…
      </p>
    ),
  },
);

const LazyTextDocumentEditor = dynamic(
  () =>
    import("./text-document-editor").then(
      (module) => module.TextDocumentEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-product-body text-files-text-muted">
        Loading editor…
      </p>
    ),
  },
);

const LazyReadOnlyDocumentViewer = dynamic(
  () =>
    import("./read-only-document-viewer").then(
      (module) => module.ReadOnlyDocumentViewer,
    ),
  { ssr: false },
);

type DocumentTab = "document" | "details" | "notes" | "comments" | "history";
export type DocumentEditorMode = "panel" | "full";

function EditableTitle({
  name,
  onRenameFile,
}: {
  name: string;
  onRenameFile: (name: string) => Promise<boolean>;
}) {
  const { value, setValue, status } = useAutosaveField({
    initial: name,
    onSave: onRenameFile,
  });
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="File name"
        className="min-w-0 flex-1 truncate rounded-md bg-transparent text-h3 font-semibold text-files-text outline-none focus-visible:bg-files-surface-muted focus-visible:px-1"
      />
      <SaveIndicator
        state={status}
        savedLabel="Name saved"
        savingLabel="Saving name…"
      />
    </div>
  );
}

function DocumentSaveNotice({
  status,
  error,
  onRetry,
  onReload,
  onDownloadCopy,
  mirrorSaved,
  mirrorError,
}: {
  status: ReturnType<typeof useDocumentAutosave<string>>["status"];
  error: string | null;
  onRetry: () => void;
  onReload: () => void;
  onDownloadCopy: () => void;
  mirrorSaved: boolean;
  mirrorError: string | null;
}) {
  if (status === "error" || status === "conflict") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 border-b border-brick bg-brick-tint px-3 py-2 text-product-meta text-brick"
      >
        <span className="flex items-center gap-1.5">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {error ??
            (status === "conflict"
              ? "This document changed somewhere else."
              : "The document could not be saved.")}
        </span>
        <span className="flex items-center gap-2">
          {status === "conflict" ? (
            <>
              <button
                type="button"
                onClick={onReload}
                className="font-medium underline underline-offset-2"
              >
                Use Planevo version
              </button>
              <button
                type="button"
                onClick={onDownloadCopy}
                className="font-medium underline underline-offset-2"
              >
                Save my copy
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 font-medium underline underline-offset-2"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Retry
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-files-border px-3">
      {mirrorError ? (
        <span role="alert" className="text-product-meta text-brick">
          Saved to Planevo. {mirrorError}
        </span>
      ) : (
        <span />
      )}
      <SaveIndicator
        state={status}
        savedLabel={
          mirrorSaved ? "Saved to Planevo and computer" : "Saved to Planevo"
        }
        savingLabel="Saving to Planevo…"
      />
    </div>
  );
}

function downloadTextCopy(file: ProductFileItem, content: string) {
  const blob = new Blob([content], {
    type: file.mime_type ?? "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TextEditorWorkspace({
  file,
  loaded,
  recoveredContent,
  onReload,
  mirrorStatus,
  onContentChanged,
}: {
  file: ProductFileItem;
  loaded: LoadedFileDocument;
  recoveredContent: string;
  onReload: () => void;
  mirrorStatus: LocalMirrorStatus | null;
  onContentChanged: (content: string) => void;
}) {
  const format = loaded.descriptor.format === "markdown" ? "markdown" : "text";
  const autosave = useDocumentAutosave({
    fileSourceId: file.id,
    initialVersion: loaded.descriptor.currentVersion,
    initialContent: recoveredContent,
    onSave: async (content, baseVersion, checkpointReason) => {
      const result = await saveFileDocument({
        fileSourceId: file.id,
        format,
        baseVersion,
        content,
        textMetadata: loaded.textMetadata ?? {
          hasUtf8Bom: false,
          newline: "lf",
          trailingNewline: content.endsWith("\n"),
        },
        checkpointReason,
      });
      if (mirrorStatus?.state !== "connected") return result;
      try {
        const bytes = encodeEditableText({
          text: content,
          ...(loaded.textMetadata ?? {
            hasUtf8Bom: false,
            newline: "lf",
            trailingNewline: content.endsWith("\n"),
          }),
        });
        await writeLocalMirror(file.id, bytes);
        return { ...result, mirrorSaved: true, mirrorError: null };
      } catch (cause) {
        return {
          ...result,
          mirrorSaved: false,
          mirrorError:
            cause instanceof Error
              ? cause.message
              : "The computer file could not be updated.",
        };
      }
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocumentSaveNotice
        status={autosave.status}
        error={autosave.error}
        onRetry={autosave.retry}
        onReload={onReload}
        onDownloadCopy={() => downloadTextCopy(file, autosave.content)}
        mirrorSaved={autosave.mirrorSaved}
        mirrorError={autosave.mirrorError}
      />
      <div className="flex min-h-0 flex-1 p-3">
        <LazyTextDocumentEditor
          value={autosave.content}
          onChange={(content) => {
            autosave.setContent(content);
            onContentChanged(content);
          }}
          format={format}
        />
      </div>
    </div>
  );
}

function PlanevoDocumentWorkspace({
  file,
  loaded,
  recoveredContent,
}: {
  file: ProductFileItem;
  loaded: LoadedFileDocument;
  recoveredContent: unknown;
}) {
  const version = useRef(loaded.descriptor.currentVersion);
  const latestContent = useRef(recoveredContent);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <LazyPlanevoEditor
        initialContent={recoveredContent}
        pageId={loaded.descriptor.pageId ?? undefined}
        saveDebounceMs={750}
        retryOnSaveError={false}
        saveDestinationLabel="Planevo"
        onContentChange={(content) => {
          latestContent.current = content;
          void writeDocumentRecoveryDraft({
            fileSourceId: file.id,
            baseVersion: version.current,
            content,
            updatedAt: new Date().toISOString(),
          });
        }}
        onSave={async (content: PlanevoPartialBlock[]) => {
          try {
            const result = await saveFileDocument({
              fileSourceId: file.id,
              format: "planevo",
              baseVersion: version.current,
              content,
            });
            version.current = result.version;
            if (
              JSON.stringify(latestContent.current) === JSON.stringify(content)
            ) {
              await clearDocumentRecoveryDraft(file.id);
            } else {
              await writeDocumentRecoveryDraft({
                fileSourceId: file.id,
                baseVersion: result.version,
                content: latestContent.current,
                updatedAt: new Date().toISOString(),
              });
            }
            return { ok: true };
          } catch (cause) {
            return {
              ok: false,
              error:
                cause instanceof Error
                  ? cause.message
                  : "Could not save this document.",
            };
          }
        }}
      />
    </div>
  );
}

function NotesTab({
  fileSourceId,
  initial,
}: {
  fileSourceId: string;
  initial: string;
}) {
  const { value, setValue, status } = useAutosaveField({
    initial,
    debounceMs: 750,
    normalize: (content) => content,
    onSave: async (content) => {
      try {
        await updateFileDocumentSidebar(fileSourceId, {
          action: "save-note",
          content,
        });
        return true;
      } catch {
        return false;
      }
    },
  });
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-h3 font-semibold text-files-text">File notes</h3>
          <p className="text-product-meta text-files-text-muted">
            Notes stay attached to this file.
          </p>
        </div>
        <SaveIndicator
          state={status}
          savedLabel="Note saved"
          savingLabel="Saving note…"
        />
      </div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add context, decisions, or reminders…"
        className="min-h-56 flex-1 resize-none rounded-files-card border border-files-border bg-files-surface p-3 text-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong"
      />
    </section>
  );
}

function CommentsTab({
  loaded,
  onRefresh,
}: {
  loaded: LoadedFileDocument;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [pageDraft, setPageDraft] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPdf = loaded.descriptor.format === "pdf";
  const canCreate = isPdf
    ? loaded.descriptor.capabilities.pdfAnnotations
    : loaded.descriptor.capabilities.createCommentThreads;

  async function createComment() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateFileDocumentSidebar(loaded.descriptor.fileSourceId, {
        action: "create-comment",
        body,
        ...(isPdf
          ? {
              anchor: {
                page: Math.max(1, Number.parseInt(pageDraft, 10) || 1),
              },
            }
          : {}),
      });
      setDraft("");
      onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add the comment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleResolved(threadId: string, resolved: boolean) {
    setSaving(true);
    setError(null);
    try {
      await updateFileDocumentSidebar(loaded.descriptor.fileSourceId, {
        action: "resolve-comment",
        threadId,
        resolved,
      });
      onRefresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the comment thread.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto p-4">
      <div className="space-y-3">
        {loaded.commentThreads.length === 0 ? (
          <p className="rounded-files-card border border-dashed border-files-border bg-files-surface-muted p-4 text-product-body text-files-text-muted">
            No comment threads yet.
          </p>
        ) : (
          loaded.commentThreads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-files-card border border-files-border bg-files-surface p-3"
            >
              {(() => {
                if (
                  !isPdf ||
                  !thread.anchor_json ||
                  typeof thread.anchor_json !== "object"
                ) {
                  return null;
                }
                const page = (thread.anchor_json as { page?: unknown }).page;
                return typeof page === "number" && Number.isInteger(page) ? (
                  <p className="mb-2 text-product-meta font-medium text-files-text-muted">
                    Page {page}
                  </p>
                ) : null;
              })()}
              {thread.comments.map((comment) => (
                <p key={comment.id} className="whitespace-pre-wrap text-body">
                  {comment.body}
                </p>
              ))}
              {thread.resolved_at ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Badge variant="secondary">Resolved</Badge>
                  {canCreate ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void toggleResolved(thread.id, false)}
                      className="text-product-meta font-medium text-files-text-muted underline underline-offset-2"
                    >
                      Reopen
                    </button>
                  ) : null}
                </div>
              ) : canCreate ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleResolved(thread.id, true)}
                  className="mt-3 text-product-meta font-medium text-files-text-muted underline underline-offset-2"
                >
                  Resolve
                </button>
              ) : null}
            </article>
          ))
        )}
      </div>
      <div className="mt-4">
        {isPdf ? (
          <label className="mb-2 block text-product-meta font-medium text-files-text-muted">
            PDF page
            <input
              type="number"
              min={1}
              step={1}
              value={pageDraft}
              disabled={!canCreate}
              onChange={(event) => setPageDraft(event.target.value)}
              className="mt-1 block w-24 rounded-files-card border border-files-border bg-files-surface px-2 py-1.5 text-product-body text-files-text outline-none focus-visible:border-files-border-strong disabled:cursor-not-allowed disabled:bg-files-surface-muted"
            />
          </label>
        ) : null}
        <textarea
          value={draft}
          disabled={!canCreate}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            canCreate
              ? isPdf
                ? "Add an annotation for this page…"
                : "Start a comment thread…"
              : isPdf
                ? "PDF annotations are available on Plus and Pro."
                : "Comment creation is available on Plus and Pro."
          }
          className="min-h-24 w-full resize-none rounded-files-card border border-files-border bg-files-surface p-3 text-body text-files-text outline-none placeholder:text-files-text-muted disabled:cursor-not-allowed disabled:bg-files-surface-muted"
        />
        {error ? (
          <p role="alert" className="mt-2 text-product-meta text-brick">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!canCreate || !draft.trim() || saving}
          onClick={() => void createComment()}
          className="mt-2 rounded-files-card bg-files-cta px-3 py-2 text-product-body font-medium text-files-cta-text outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPdf ? "Add annotation" : "Add comment"}
        </button>
      </div>
    </section>
  );
}

function HistoryTab({
  loaded,
  onRestored,
}: {
  loaded: LoadedFileDocument;
  onRestored: () => void;
}) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  async function restore(revisionId: string) {
    setRestoringId(revisionId);
    setRestoreError(null);
    try {
      await restoreFileDocumentRevision(
        loaded.descriptor.fileSourceId,
        revisionId,
        loaded.descriptor.currentVersion,
      );
      await clearDocumentRecoveryDraft(loaded.descriptor.fileSourceId);
      onRestored();
    } catch (cause) {
      setRestoreError(
        cause instanceof Error
          ? cause.message
          : "Could not restore this version.",
      );
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto p-4">
      <h3 className="text-h3 font-semibold text-files-text">Version history</h3>
      <p className="mt-1 text-product-meta text-files-text-muted">
        Checkpoints are kept for your plan&apos;s retention window.
      </p>
      <ol className="mt-4 space-y-2">
        <li className="rounded-files-card border border-files-border bg-files-surface p-3">
          <p className="text-product-body font-medium">Current version</p>
          <p className="text-product-meta text-files-text-muted">
            Version {loaded.descriptor.currentVersion}
          </p>
        </li>
        {loaded.revisions.map((revision) => (
          <li
            key={revision.id}
            className="flex items-center justify-between gap-3 rounded-files-card border border-files-border bg-files-surface p-3"
          >
            <div>
              <p className="text-product-body font-medium">
                Version {revision.version}
              </p>
              <p className="text-product-meta text-files-text-muted">
                {new Date(revision.created_at).toLocaleString()} ·{" "}
                {formatBytes(revision.size_bytes)}
              </p>
            </div>
            <button
              type="button"
              disabled={restoringId !== null}
              onClick={() => void restore(revision.id)}
              className="rounded-files-card border border-files-border px-3 py-1.5 text-product-meta font-medium text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:opacity-50"
            >
              {restoringId === revision.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ol>
      {restoreError ? (
        <p role="alert" className="mt-3 text-product-meta text-brick">
          {restoreError}
        </p>
      ) : null}
    </section>
  );
}

export function DocumentEditorPanel({
  file,
  mode,
  onModeChange,
  onClose,
  onUpdateTags,
  onRenameFile,
  onImportedDocument,
}: {
  file: ProductFileItem;
  mode: DocumentEditorMode;
  onModeChange: (mode: DocumentEditorMode) => void;
  onClose: () => void;
  onUpdateTags: (tags: string[]) => void;
  onRenameFile: (name: string) => Promise<boolean>;
  onImportedDocument: (fileSourceId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<DocumentTab>("document");
  const [loaded, setLoaded] = useState<LoadedFileDocument | null>(null);
  const [recoveredContent, setRecoveredContent] = useState<unknown>(null);
  const [recovered, setRecovered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [width, setWidth] = useState(getPreviewWidth);
  const [mirrorStatus, setMirrorStatus] = useState<LocalMirrorStatus | null>(
    null,
  );
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [mirrorMessage, setMirrorMessage] = useState<string | null>(null);
  const [docxText, setDocxText] = useState<string | null>(null);
  const [importingDocx, setImportingDocx] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null);
      try {
        const next = await loadFileDocument(file.id, signal);
        const draft = await readDocumentRecoveryDraft(file.id);
        const useDraft =
          draft !== null &&
          draft.baseVersion === next.descriptor.currentVersion &&
          (next.descriptor.format === "planevo"
            ? Array.isArray(draft.content)
            : typeof draft.content === "string");
        setLoaded(next);
        setRecoveredContent(useDraft ? draft.content : next.content);
        setRecovered(useDraft);
        if (
          next.descriptor.capabilities.localMirror &&
          (next.descriptor.format === "markdown" ||
            next.descriptor.format === "text")
        ) {
          setMirrorStatus(await localMirrorStatus(file.id));
        } else {
          setMirrorStatus(null);
        }
      } catch (cause) {
        if ((cause as { name?: string })?.name === "AbortError") return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Could not open this document.",
        );
      }
    },
    [file.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [load]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || mode === "full") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next =
      drag.current.startWidth + (drag.current.startX - event.clientX);
    setWidth(Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, next)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPreviewWidth(width);
  }

  function resizeFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (mode === "full") return;
    const direction =
      event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const next = Math.min(
      MAX_PREVIEW_WIDTH,
      Math.max(MIN_PREVIEW_WIDTH, width + direction * 24),
    );
    setWidth(next);
    setPreviewWidth(next);
  }

  function addTag() {
    const tag = tagDraft.trim();
    setTagDraft("");
    if (!tag || file.tags.includes(tag)) return;
    onUpdateTags([...file.tags, tag]);
  }

  async function connectMirror() {
    if (
      !loaded ||
      (loaded.descriptor.format !== "markdown" &&
        loaded.descriptor.format !== "text") ||
      typeof loaded.content !== "string"
    ) {
      return;
    }
    setMirrorBusy(true);
    setMirrorMessage(null);
    try {
      const expectedContent = encodeEditableText({
        text: loaded.content,
        ...(loaded.textMetadata ?? {
          hasUtf8Bom: false,
          newline: "lf",
          trailingNewline: loaded.content.endsWith("\n"),
        }),
      });
      const next =
        mirrorStatus?.state === "permission-needed"
          ? await reconnectLocalMirror(file.id)
          : await connectLocalMirror(file.id, expectedContent);
      setMirrorStatus(next);
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError") {
        setMirrorMessage(
          cause instanceof Error
            ? cause.message
            : "Could not connect the computer file.",
        );
      }
    } finally {
      setMirrorBusy(false);
    }
  }

  async function forgetMirror() {
    setMirrorBusy(true);
    try {
      await forgetLocalMirror(file.id);
      setMirrorStatus(await localMirrorStatus(file.id));
      setMirrorMessage(null);
    } catch (cause) {
      setMirrorMessage(
        cause instanceof Error
          ? cause.message
          : "Could not forget the computer file.",
      );
    } finally {
      setMirrorBusy(false);
    }
  }

  async function importDocx() {
    if (!docxText || importingDocx) return;
    setImportingDocx(true);
    const title = file.name.replace(/\.docx$/i, "") || "Imported document";
    try {
      const result = await importProductDocumentAction({
        sourceFileId: file.id,
        title,
        text: docxText,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Imported as a Planevo document");
      onImportedDocument(result.data.fileSourceId);
    } finally {
      setImportingDocx(false);
    }
  }

  return (
    <aside
      aria-label={`Editor for ${file.name}`}
      style={mode === "panel" ? { width } : undefined}
      className={
        mode === "full"
          ? "relative flex min-w-0 flex-1 flex-col overflow-hidden border-l border-files-border bg-files-surface"
          : "relative flex w-full flex-col overflow-hidden border-t border-files-border bg-files-surface max-lg:w-full! lg:shrink-0 lg:border-l lg:border-t-0"
      }
    >
      <div
        role="separator"
        tabIndex={mode === "panel" ? 0 : -1}
        aria-orientation="vertical"
        aria-label="Resize document editor"
        aria-valuemin={MIN_PREVIEW_WIDTH}
        aria-valuemax={MAX_PREVIEW_WIDTH}
        aria-valuenow={width}
        title="Drag or use arrow keys to resize"
        onKeyDown={resizeFromKeyboard}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="absolute inset-y-0 left-0 z-50 hidden w-1 cursor-col-resize touch-none bg-transparent outline-none transition-colors hover:bg-files-border-strong focus-visible:bg-files-cta motion-reduce:transition-none lg:block"
      />

      <header className="border-b border-files-border px-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <EditableTitle name={file.name} onRenameFile={onRenameFile} />
            <p className="mt-0.5 text-product-meta text-files-text-muted">
              {file.size_bytes === null
                ? "Planevo document"
                : formatBytes(file.size_bytes)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={
                mode === "full" ? "Exit full editor" : "Open full editor"
              }
              onClick={() => onModeChange(mode === "full" ? "panel" : "full")}
              className="flex size-8 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
            >
              {mode === "full" ? (
                <Minimize2 aria-hidden="true" className="size-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="size-4" />
              )}
            </button>
            <button
              type="button"
              aria-label="Close document editor"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <nav
          aria-label="Document sections"
          className="mt-3 flex overflow-x-auto"
        >
          {(
            [
              ["document", "Document"],
              ["details", "Details"],
              ["notes", "Notes"],
              [
                "comments",
                loaded?.descriptor.format === "pdf"
                  ? "Annotations"
                  : "Comments",
              ],
              ["history", "History"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              aria-current={activeTab === tab ? "page" : undefined}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 border-b-2 px-3 py-2 text-product-meta font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta ${
                activeTab === tab
                  ? "border-files-cta text-files-text"
                  : "border-transparent text-files-text-muted hover:text-files-text"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="m-4 rounded-files-card border border-brick bg-brick-tint p-4 text-product-body text-brick"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 flex items-center gap-1.5 font-medium underline underline-offset-2"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </button>
        </div>
      ) : !loaded ? (
        <p className="p-4 text-product-body text-files-text-muted">
          Opening document…
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {recovered && activeTab === "document" ? (
            <div
              role="status"
              className="border-b border-meadow bg-meadow-tint px-3 py-2 text-product-meta text-meadow"
            >
              Recovered unsaved changes from this browser.
            </div>
          ) : null}

          <div
            className={
              activeTab === "document" ? "flex min-h-0 flex-1" : "hidden"
            }
          >
            {loaded.descriptor.format === "planevo" ? (
              <PlanevoDocumentWorkspace
                key={`${file.id}-${loaded.descriptor.currentVersion}`}
                file={file}
                loaded={loaded}
                recoveredContent={recoveredContent}
              />
            ) : loaded.descriptor.format === "markdown" ||
              loaded.descriptor.format === "text" ? (
              <TextEditorWorkspace
                key={`${file.id}-${loaded.descriptor.currentVersion}`}
                file={file}
                loaded={loaded}
                recoveredContent={
                  typeof recoveredContent === "string" ? recoveredContent : ""
                }
                onReload={() => void load()}
                mirrorStatus={mirrorStatus}
                onContentChanged={setRecoveredContent}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto bg-files-surface-muted">
                <LazyReadOnlyDocumentViewer
                  format={loaded.descriptor.format}
                  previewUrl={file.previewUrl}
                  onTextExtracted={setDocxText}
                />
              </div>
            )}
          </div>

          {activeTab === "details" ? (
            <section className="min-h-0 flex-1 overflow-auto p-4">
              <h3 className="text-label uppercase text-files-text-muted">
                Tags
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {file.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() =>
                        onUpdateTags(
                          file.tags.filter((existing) => existing !== tag),
                        )
                      }
                      className="text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-files-cta"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </Badge>
                ))}
                {file.tags.length === 0 ? (
                  <span className="text-product-meta text-files-text-muted">
                    No tags yet
                  </span>
                ) : null}
              </div>
              <input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addTag();
                }}
                placeholder="Add a tag and press Enter"
                aria-label="Add a tag"
                className="mt-3 w-full rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong"
              />
              {file.previewUrl ? (
                <a
                  href={file.previewUrl}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Download original
                </a>
              ) : null}
              {loaded.descriptor.format === "markdown" ||
              loaded.descriptor.format === "text" ? (
                <button
                  type="button"
                  onClick={() =>
                    downloadTextCopy(
                      file,
                      typeof recoveredContent === "string"
                        ? recoveredContent
                        : "",
                    )
                  }
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Save edited copy
                </button>
              ) : null}
              {loaded.descriptor.format === "docx" ? (
                <button
                  type="button"
                  disabled={!docxText || importingDocx}
                  onClick={() => void importDocx()}
                  className="mt-2 flex w-full items-center justify-center rounded-files-card bg-files-cta px-3 py-2 text-product-body font-medium text-files-cta-text outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importingDocx ? "Importing…" : "Import as Planevo document"}
                </button>
              ) : null}
              {loaded.descriptor.format === "markdown" ||
              loaded.descriptor.format === "text" ? (
                <div className="mt-5 border-t border-files-border pt-4">
                  <h3 className="text-label uppercase text-files-text-muted">
                    Computer mirror
                  </h3>
                  {!loaded.descriptor.capabilities.localMirror ? (
                    <p className="mt-2 text-product-body text-files-text-muted">
                      Automatic writeback to the original computer file is
                      available on Plus and Pro.
                    </p>
                  ) : mirrorStatus?.state === "unsupported" ? (
                    <p className="mt-2 text-product-body text-files-text-muted">
                      This browser can save an edited copy, but cannot write
                      back to the original. Use Chrome or Edge on desktop for
                      automatic writeback.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-product-body text-files-text-muted">
                        {mirrorStatus?.state === "connected"
                          ? `Connected to ${mirrorStatus.name}`
                          : mirrorStatus?.state === "permission-needed"
                            ? `Reconnect ${mirrorStatus.name} to resume writeback.`
                            : mirrorStatus?.state === "missing"
                              ? `${mirrorStatus.name} was moved or deleted. Locate it again.`
                              : "Connect the original file to save every Planevo edit back to your computer."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={mirrorBusy}
                          onClick={() => void connectMirror()}
                          className="rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:opacity-50"
                        >
                          {mirrorStatus?.state === "connected"
                            ? "Choose a different file"
                            : mirrorStatus?.state === "permission-needed"
                              ? "Reconnect file"
                              : "Connect computer file"}
                        </button>
                        {mirrorStatus &&
                        mirrorStatus.state !== "disconnected" ? (
                          <button
                            type="button"
                            disabled={mirrorBusy}
                            onClick={() => void forgetMirror()}
                            className="rounded-files-card px-3 py-2 text-product-body font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:opacity-50"
                          >
                            Forget mirror
                          </button>
                        ) : null}
                      </div>
                      {mirrorMessage ? (
                        <p
                          role="alert"
                          className="mt-2 text-product-meta text-brick"
                        >
                          {mirrorMessage}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "notes" ? (
            <NotesTab
              fileSourceId={file.id}
              initial={loaded.note?.content ?? ""}
            />
          ) : null}
          {activeTab === "comments" ? (
            <CommentsTab loaded={loaded} onRefresh={() => void load()} />
          ) : null}
          {activeTab === "history" ? (
            <HistoryTab loaded={loaded} onRestored={() => void load()} />
          ) : null}
        </div>
      )}
    </aside>
  );
}
