"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Columns2,
  Download,
  Eye,
  FileText,
  History,
  Layers2,
  MessageSquareText,
  NotebookTabs,
  PanelBottom,
  Pilcrow,
  RefreshCw,
  Tags,
  X,
} from "lucide-react";
import type { PlanevoPartialBlock } from "@/features/editor/schema";
import { encodeEditableText } from "@planevo/core/files/text-roundtrip";
import { Badge } from "@/components/ui/badge";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import { DocumentLayoutPicker } from "./document-layout-picker";
import {
  getFileEditorPreferences,
  setFileEditorPreferences,
  type DocumentEditorMode,
  type MarkdownViewMode,
} from "@/lib/files/editor-prefs";
import { formatBytes } from "./storage-meter";
import { importProductDocumentAction } from "@/app/(workspace)/files/actions";
import { toast } from "@/components/ui/toast";
import {
  updateFileDocumentSidebar,
  type LoadedFileDocument,
} from "./document-client";
import {
  documentRepositoryFor,
  type FileDocumentRepository,
} from "./document-repository";
import {
  clearDocumentRecoveryDraft,
  readDocumentRecoveryDraft,
  writeDocumentRecoveryDraft,
} from "./document-recovery";
import type { ProductFileItem } from "./files-table";
import { syncLocalProductFile } from "./product-file-uploads";
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

type UtilityTab = "details" | "notes" | "comments" | "history";
export type { DocumentEditorMode } from "@/lib/files/editor-prefs";

const MIN_SIDE_WIDTH = 420;
const MAX_SIDE_WIDTH = 900;
const MIN_BOTTOM_HEIGHT = 320;
const MAX_BOTTOM_HEIGHT = 1200;
const MIN_EDITOR_REMAINDER = 160;
const MIN_UTILITY_HEIGHT = 176;
const MAX_UTILITY_HEIGHT = 440;

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
  // Sized as the final breadcrumb segment rather than a page heading: it is an editable path
  // crumb, and styling it as an h3-scale form field made the title area read as a form.
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="File name"
        size={Math.max(value.length, 1)}
        className="min-w-0 max-w-full truncate rounded bg-transparent text-product-body text-files-text outline-none focus-visible:bg-files-surface-muted"
      />
      <SaveIndicator state={status} savedLabel="" savingLabel="Renaming…" />
    </span>
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
  localOnly = false,
}: {
  status: ReturnType<typeof useDocumentAutosave<string>>["status"];
  error: string | null;
  onRetry: () => void;
  onReload: () => void;
  onDownloadCopy: () => void;
  mirrorSaved: boolean;
  mirrorError: string | null;
  localOnly?: boolean;
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

  // Success is not news: the healthy save state is one quiet indicator in the breadcrumb row
  // (see `saveState` below), not a full-width band pushing the document down.
  if (!mirrorError) return null;
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-files-border px-3">
      <span role="alert" className="text-product-meta text-brick">
        Saved to Planevo. {mirrorError}
      </span>
      <SaveIndicator
        state={status}
        savedLabel={
          localOnly
            ? "Saved to computer"
            : mirrorSaved
              ? "Saved to Planevo and computer"
              : "Saved to Planevo"
        }
        savingLabel={localOnly ? "Saving to computer…" : "Saving to Planevo…"}
      />
    </div>
  );
}

export type DocumentSaveState = {
  status: ReturnType<typeof useDocumentAutosave<string>>["status"];
  savedLabel: string;
  savingLabel: string;
};

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
  markdownView,
  onSaveStateChange,
  repository,
}: {
  file: ProductFileItem;
  loaded: LoadedFileDocument;
  recoveredContent: string;
  onReload: () => void;
  mirrorStatus: LocalMirrorStatus | null;
  onContentChanged: (content: string) => void;
  markdownView: MarkdownViewMode;
  onSaveStateChange: (state: DocumentSaveState) => void;
  repository: FileDocumentRepository;
}) {
  const format = loaded.descriptor.format === "markdown" ? "markdown" : "text";
  const autosave = useDocumentAutosave({
    fileSourceId: file.id,
    initialVersion: loaded.descriptor.currentVersion,
    initialContent: recoveredContent,
    onSave: async (content, baseVersion, checkpointReason) => {
      const result = await repository.save({
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

  const localOnly = file.storage_kind === "local";
  useEffect(() => {
    onSaveStateChange({
      status: autosave.status,
      savedLabel: localOnly
        ? "Saved to computer"
        : autosave.mirrorSaved
          ? "Saved to Planevo and computer"
          : "Saved to Planevo",
      savingLabel: localOnly ? "Saving to computer…" : "Saving to Planevo…",
    });
  }, [
    autosave.mirrorSaved,
    autosave.status,
    localOnly,
    onSaveStateChange,
  ]);

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
        localOnly={localOnly}
      />
      <div className="flex min-h-0 flex-1">
        <LazyTextDocumentEditor
          value={autosave.content}
          onChange={(content) => {
            autosave.setContent(content);
            onContentChanged(content);
          }}
          format={format}
          viewMode={markdownView}
          onSaveNow={() => void autosave.flush("close")}
        />
      </div>
    </div>
  );
}

function PlanevoDocumentWorkspace({
  file,
  loaded,
  recoveredContent,
  repository,
}: {
  file: ProductFileItem;
  loaded: LoadedFileDocument;
  recoveredContent: unknown;
  repository: FileDocumentRepository;
}) {
  const version = useRef(loaded.descriptor.currentVersion);
  const latestContent = useRef(recoveredContent);

  return (
    // pt-16 is not decoration: the block editor floats its formatting toolbar ~44px above the
    // selection, so the first block needs at least that much clearance or the toolbar lands on
    // the chrome. Matches the markdown view's top padding in spirit.
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-16">
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
            const result = await repository.save({
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
  onSaveNote,
}: {
  fileSourceId: string;
  initial: string;
  onSaveNote?: (content: string) => Promise<boolean>;
}) {
  const { value, setValue, status } = useAutosaveField({
    initial,
    debounceMs: 750,
    normalize: (content) => content,
    onSave: async (content) => {
      if (onSaveNote) return onSaveNote(content);
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
  onRestoreRevision,
}: {
  loaded: LoadedFileDocument;
  onRestored: () => void;
  onRestoreRevision: (revisionId: string) => Promise<void>;
}) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  async function restore(revisionId: string) {
    setRestoringId(revisionId);
    setRestoreError(null);
    try {
      await onRestoreRevision(revisionId);
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
  onFileSynchronized,
}: {
  file: ProductFileItem;
  mode: DocumentEditorMode;
  onModeChange: (mode: DocumentEditorMode) => void;
  onClose: () => void;
  onUpdateTags: (tags: string[]) => void;
  onRenameFile: (name: string) => Promise<boolean>;
  onImportedDocument: (fileSourceId: string) => void;
  onFileSynchronized: () => void;
}) {
  const [activeUtility, setActiveUtility] = useState<UtilityTab | null>(() => {
    const stored = getFileEditorPreferences().utilityTab;
    return stored === "closed" ? null : stored;
  });
  const [loaded, setLoaded] = useState<LoadedFileDocument | null>(null);
  const [recoveredContent, setRecoveredContent] = useState<unknown>(null);
  const [recovered, setRecovered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [sideWidth, setSideWidth] = useState(
    () => getFileEditorPreferences().sideWidth,
  );
  const [bottomHeight, setBottomHeight] = useState(
    () => getFileEditorPreferences().bottomHeight,
  );
  const [utilityHeight, setUtilityHeight] = useState(
    () => getFileEditorPreferences().utilityHeight,
  );
  const [markdownView, setMarkdownView] = useState<MarkdownViewMode>(
    () => getFileEditorPreferences().markdownView,
  );
  const [mirrorStatus, setMirrorStatus] = useState<LocalMirrorStatus | null>(null);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [mirrorMessage, setMirrorMessage] = useState<string | null>(null);
  const [docxText, setDocxText] = useState<string | null>(null);
  const [importingDocument, setImportingDocument] = useState(false);
  const [syncingLocalFile, setSyncingLocalFile] = useState(false);
  const [saveState, setSaveState] = useState<DocumentSaveState | null>(null);
  const repository = useMemo(
    () =>
      documentRepositoryFor({
        id: file.id,
        storage_kind: file.storage_kind,
        name: file.name,
        mime_type: file.mime_type,
      }),
    [file.id, file.mime_type, file.name, file.storage_kind],
  );
  const drag = useRef<{
    kind: "side" | "bottom" | "utility";
    start: number;
    size: number;
  } | null>(null);

  const persistEditorPreferences = useCallback(
    (patch: Partial<ReturnType<typeof getFileEditorPreferences>>) => {
      setFileEditorPreferences({ ...getFileEditorPreferences(), ...patch });
    },
    [],
  );

  useEffect(() => {
    persistEditorPreferences({ mode });
  }, [mode, persistEditorPreferences]);

  const isMarkdown = loaded?.descriptor.format === "markdown";
  const isDirty = saveState?.status === "saving";

  // Cmd/Ctrl+Shift+V flips between prose and source, matching the editor most people arrive from.
  // Unlike that editor's one-way toggle, every view stays reachable from the segmented control.
  useEffect(() => {
    if (!isMarkdown) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.key.toLowerCase() !== "v") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setMarkdownView((current) => {
        const next = current === "document" ? "markdown" : "document";
        persistEditorPreferences({ markdownView: next });
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMarkdown, persistEditorPreferences]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null);
      try {
        const next = await repository.load(signal);
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
          cause instanceof Error ? cause.message : "Could not open this document.",
        );
      }
    },
    [file.id, repository],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  async function retryLoad() {
    if (file.storage_kind === "local") {
      await reconnectLocalMirror(file.id);
    }
    await load();
  }

  function startResize(
    event: React.PointerEvent<HTMLDivElement>,
    kind: "side" | "bottom" | "utility",
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      kind,
      start: kind === "side" ? event.clientX : event.clientY,
      size:
        kind === "side"
          ? sideWidth
          : kind === "bottom"
            ? bottomHeight
            : utilityHeight,
    };
  }

  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const delta =
      drag.current.kind === "side"
        ? drag.current.start - event.clientX
        : drag.current.start - event.clientY;
    if (drag.current.kind === "side") {
      setSideWidth(
        Math.min(MAX_SIDE_WIDTH, Math.max(MIN_SIDE_WIDTH, drag.current.size + delta)),
      );
      return;
    }
    if (drag.current.kind === "bottom") {
      const maximum = Math.max(
        MIN_BOTTOM_HEIGHT,
        window.innerHeight - MIN_EDITOR_REMAINDER,
      );
      setBottomHeight(
        Math.min(maximum, Math.max(MIN_BOTTOM_HEIGHT, drag.current.size + delta)),
      );
      return;
    }
    setUtilityHeight(
      Math.min(
        MAX_UTILITY_HEIGHT,
        Math.max(MIN_UTILITY_HEIGHT, drag.current.size + delta),
      ),
    );
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const kind = drag.current.kind;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistEditorPreferences(
      kind === "side"
        ? { sideWidth }
        : kind === "bottom"
          ? { bottomHeight }
          : { utilityHeight },
    );
  }

  function resizeFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (mode === "full") return;
    const delta =
      mode === "side"
        ? event.key === "ArrowLeft"
          ? 24
          : event.key === "ArrowRight"
            ? -24
            : 0
        : event.key === "ArrowUp"
          ? 24
          : event.key === "ArrowDown"
            ? -24
            : 0;
    if (!delta) return;
    event.preventDefault();
    if (mode === "side") {
      const next = Math.min(
        MAX_SIDE_WIDTH,
        Math.max(MIN_SIDE_WIDTH, sideWidth + delta),
      );
      setSideWidth(next);
      persistEditorPreferences({ sideWidth: next });
    } else {
      const maximum = Math.max(
        MIN_BOTTOM_HEIGHT,
        window.innerHeight - MIN_EDITOR_REMAINDER,
      );
      const next = Math.min(
        maximum,
        Math.max(MIN_BOTTOM_HEIGHT, bottomHeight + delta),
      );
      setBottomHeight(next);
      persistEditorPreferences({ bottomHeight: next });
    }
  }

  function selectUtility(tab: UtilityTab) {
    const next = activeUtility === tab ? null : tab;
    setActiveUtility(next);
    persistEditorPreferences({ utilityTab: next ?? "closed" });
  }

  function changeMarkdownView(next: MarkdownViewMode) {
    setMarkdownView(next);
    persistEditorPreferences({ markdownView: next });
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
        text:
          typeof recoveredContent === "string"
            ? recoveredContent
            : loaded.content,
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

  async function importAsDocument(
    text: string,
    extension: RegExp,
    format: "plain" | "markdown" = "plain",
  ) {
    if (!text || importingDocument) return;
    setImportingDocument(true);
    const title = file.name.replace(extension, "") || "Imported document";
    try {
      const result = await importProductDocumentAction({
        sourceFileId: file.id,
        title,
        text,
        format,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Created a separate Planevo document");
      onImportedDocument(result.data.fileSourceId);
    } finally {
      setImportingDocument(false);
    }
  }

  async function syncLocalFile() {
    if (file.storage_kind !== "local" || syncingLocalFile) return;
    setSyncingLocalFile(true);
    try {
      await syncLocalProductFile(file.id);
      toast("Cloud sync enabled for this file");
      onFileSynchronized();
    } catch (cause) {
      toast(
        cause instanceof Error
          ? cause.message
          : "Could not enable cloud sync.",
        { tone: "error" },
      );
    } finally {
      setSyncingLocalFile(false);
    }
  }

  const editorStyle =
    mode === "side"
      ? { width: sideWidth }
      : mode === "bottom"
        ? { height: bottomHeight }
        : undefined;
  const editorClass =
    mode === "full"
      ? "files-editor-shell files-editor-shell--full relative flex min-w-0 flex-1 flex-col overflow-hidden"
      : mode === "side"
        ? "files-editor-shell files-editor-shell--side relative flex h-full shrink-0 flex-col overflow-hidden rounded-l-files-editor"
        : "files-editor-shell files-editor-shell--bottom absolute inset-x-3 bottom-3 z-40 flex max-h-full flex-col overflow-hidden rounded-files-editor";

  const utilityLabels: Record<UtilityTab, string> = {
    details: "Details",
    notes: "Notes",
    comments: loaded?.descriptor.format === "pdf" ? "Annotations" : "Comments",
    history: "History",
  };

  return (
    <aside
      aria-label={`Editor for ${file.name}`}
      style={editorStyle}
      className={editorClass}
    >
      {mode !== "full" ? (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation={mode === "side" ? "vertical" : "horizontal"}
          aria-label="Resize document editor"
          aria-valuemin={mode === "side" ? MIN_SIDE_WIDTH : MIN_BOTTOM_HEIGHT}
          aria-valuemax={mode === "side" ? MAX_SIDE_WIDTH : MAX_BOTTOM_HEIGHT}
          aria-valuenow={mode === "side" ? sideWidth : bottomHeight}
          title="Drag or use arrow keys to resize"
          onKeyDown={resizeFromKeyboard}
          onPointerDown={(event) =>
            startResize(event, mode === "side" ? "side" : "bottom")
          }
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className={`files-editor-resize absolute z-50 touch-none bg-transparent outline-none hover:bg-files-border-strong ${
            mode === "side"
              ? "inset-y-0 left-0 w-1 cursor-col-resize"
              : "inset-x-0 top-0 h-1 cursor-row-resize"
          }`}
        />
      ) : null}

      {/*
        Two rows of chrome, then the document — a tab for identity and a breadcrumb for place.
        Everything else (utilities, layout, view mode) is an affordance on those rows rather than
        a row of its own.
      */}
      {/*
        Opaque and above the document on purpose. Editors float their own toolbars near the
        selection, and a block selected close to the top of the scroll area puts that toolbar
        right where the breadcrumb is. Chrome has to occlude scrolling content, not blend with it.
      */}
      <header className="relative z-20 shrink-0 bg-files-editor-solid">
        <div className="flex items-stretch gap-2 border-b border-files-border pr-2">
          <div
            className="flex min-w-0 items-center gap-2 border-t-2 border-files-cta bg-files-editor-solid px-3 py-2"
            aria-current="page"
          >
            <FileText
              aria-hidden="true"
              className="size-3.5 shrink-0 text-files-cta"
            />
            <span className="truncate text-product-title text-files-text">
              {file.name}
            </span>
            <button
              type="button"
              aria-label="Close document editor"
              onClick={onClose}
              className="files-editor-control flex size-5 shrink-0 items-center justify-center rounded text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text"
            >
              {/* A dot rather than an × while unsaved, matching the editor convention. */}
              {isDirty ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-files-text-muted"
                />
              ) : (
                <X aria-hidden="true" className="size-3.5" />
              )}
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            {isMarkdown ? (
              <div
                role="group"
                aria-label="Markdown view"
                className="flex shrink-0 items-center rounded-full border border-files-border p-0.5"
              >
                {(
                  [
                    ["document", Pilcrow, "Document"],
                    ["markdown", Eye, "Markdown"],
                    ["split", Columns2, "Split"],
                  ] as const
                ).map(([view, Icon, label]) => (
                  <button
                    key={view}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={markdownView === view}
                    onClick={() => changeMarkdownView(view)}
                    className="files-editor-control flex size-7 items-center justify-center rounded-full text-files-text-muted outline-none hover:text-files-text aria-pressed:bg-files-surface-muted aria-pressed:text-files-text"
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </button>
                ))}
              </div>
            ) : null}
            <DocumentLayoutPicker mode={mode} onModeChange={onModeChange} />
            <button
              type="button"
              aria-label="Document details"
              title="Details, notes, comments, history"
              aria-pressed={activeUtility !== null}
              onClick={() => selectUtility(activeUtility ?? "details")}
              className="files-editor-control flex size-8 items-center justify-center rounded-full text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text aria-pressed:bg-files-surface-muted aria-pressed:text-files-text"
            >
              <PanelBottom aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-files-border px-3 py-1.5 text-product-meta text-files-text-muted">
          <FileText aria-hidden="true" className="size-3 shrink-0" />
          <ChevronRight aria-hidden="true" className="size-3 shrink-0" />
          <EditableTitle name={file.name} onRenameFile={onRenameFile} />
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span>
              {file.size_bytes === null
                ? "Planevo document"
                : formatBytes(file.size_bytes)}
            </span>
            {/* Conflicts get the full-width alert row instead; this stays the quiet channel. */}
            {saveState && saveState.status !== "conflict" ? (
              <SaveIndicator
                state={saveState.status}
                savedLabel={saveState.savedLabel}
                savingLabel={saveState.savingLabel}
              />
            ) : null}
          </span>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="m-4 rounded-files-card border border-brick bg-brick-tint p-4 text-product-body text-brick"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void retryLoad()}
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
          {recovered ? (
            <div
              role="status"
              className="border-b border-meadow bg-meadow-tint px-3 py-2 text-product-meta text-meadow"
            >
              Recovered unsaved changes from this browser.
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1">
            {loaded.descriptor.format === "planevo" ? (
              <PlanevoDocumentWorkspace
                key={`${file.id}-${loaded.descriptor.currentVersion}`}
                file={file}
                loaded={loaded}
                recoveredContent={recoveredContent}
                repository={repository}
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
                markdownView={markdownView}
                onSaveStateChange={setSaveState}
                repository={repository}
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

          {activeUtility ? (
            <section
              aria-label={`${utilityLabels[activeUtility]} utility dock`}
              style={{ height: utilityHeight }}
              className="files-editor-utility relative flex shrink-0 flex-col border-x-0 border-b-0"
            >
              <div
                role="separator"
                tabIndex={0}
                aria-orientation="horizontal"
                aria-label="Resize utility dock"
                aria-valuemin={MIN_UTILITY_HEIGHT}
                aria-valuemax={MAX_UTILITY_HEIGHT}
                aria-valuenow={utilityHeight}
                onPointerDown={(event) => startResize(event, "utility")}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onKeyDown={(event) => {
                  const delta =
                    event.key === "ArrowUp"
                      ? 24
                      : event.key === "ArrowDown"
                        ? -24
                        : 0;
                  if (!delta) return;
                  event.preventDefault();
                  const next = Math.min(
                    MAX_UTILITY_HEIGHT,
                    Math.max(MIN_UTILITY_HEIGHT, utilityHeight + delta),
                  );
                  setUtilityHeight(next);
                  persistEditorPreferences({ utilityHeight: next });
                }}
                className="files-editor-resize absolute inset-x-0 top-0 h-1 cursor-row-resize touch-none bg-transparent outline-none hover:bg-files-border-strong"
              />
              {/* Triggers live on the dock, not above the document — the document outranks them. */}
              <div className="flex items-center justify-between gap-2 border-b border-files-border px-3 py-1.5">
                <nav
                  aria-label="Document utilities"
                  className="flex items-center gap-1 overflow-x-auto"
                >
                  {(
                    [
                      ["details", Tags],
                      ["notes", NotebookTabs],
                      ["comments", MessageSquareText],
                      ["history", History],
                    ] as const
                  ).map(([tab, Icon]) => (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={activeUtility === tab}
                      onClick={() => setActiveUtility(tab)}
                      className="files-editor-control flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-product-meta font-medium text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text aria-pressed:bg-files-surface-muted aria-pressed:text-files-text"
                    >
                      <Icon aria-hidden="true" className="size-3.5" />
                      {utilityLabels[tab]}
                    </button>
                  ))}
                </nav>
                <button
                  type="button"
                  aria-label="Close utility dock"
                  onClick={() => selectUtility(activeUtility)}
                  className="files-editor-control flex size-7 shrink-0 items-center justify-center rounded-full text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>

              {activeUtility === "details" ? (
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <h4 className="text-label uppercase text-files-text-muted">Tags</h4>
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
                          className="text-files-text-muted outline-none hover:text-files-text"
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
                    className="mt-3 w-full rounded-files-card border border-files-border bg-files-editor-solid px-3 py-2 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong"
                  />

                  {loaded.descriptor.format === "markdown" ||
                  loaded.descriptor.format === "text" ? (
                    <div className="mt-4 border-t border-files-border pt-4">
                      <h4 className="text-label uppercase text-files-text-muted">
                        Original computer file
                      </h4>
                      <p className="mt-2 text-product-body text-files-text-muted">
                        {mirrorStatus?.state === "connected"
                          ? `Saving edits to ${mirrorStatus.name}`
                          : mirrorStatus?.state === "permission-needed"
                            ? `Reconnect ${mirrorStatus.name} to resume saving.`
                            : mirrorStatus?.state === "missing"
                              ? `${mirrorStatus.name} was moved or deleted.`
                              : mirrorStatus?.state === "unsupported"
                                ? "This browser cannot write back to the original file."
                                : "Connect the original file to save edits back to your computer."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {file.storage_kind === "local" ? (
                          <button
                            type="button"
                            disabled={syncingLocalFile}
                            onClick={() => void syncLocalFile()}
                            className="files-editor-control rounded-files-card bg-files-cta px-3 py-2 text-product-body font-medium text-files-cta-text outline-none hover:opacity-90 disabled:opacity-50"
                          >
                            {syncingLocalFile
                              ? "Syncing…"
                              : "Sync to Planevo"}
                          </button>
                        ) : null}
                        {mirrorStatus?.state !== "unsupported" ? (
                          <button
                            type="button"
                            disabled={mirrorBusy}
                            onClick={() => void connectMirror()}
                            className="files-editor-control rounded-files-card border border-files-border bg-files-editor-solid px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted disabled:opacity-50"
                          >
                            {mirrorStatus?.state === "permission-needed"
                              ? "Reconnect file"
                              : mirrorStatus?.state === "connected"
                                ? "Choose another file"
                                : "Connect computer file"}
                          </button>
                        ) : null}
                        {mirrorStatus &&
                        mirrorStatus.state !== "disconnected" &&
                        mirrorStatus.state !== "unsupported" ? (
                          <button
                            type="button"
                            disabled={mirrorBusy}
                            onClick={() => void forgetMirror()}
                            className="files-editor-control rounded-files-card px-3 py-2 text-product-body font-medium text-files-text-muted outline-none hover:text-files-text disabled:opacity-50"
                          >
                            Forget file
                          </button>
                        ) : null}
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
                          className="files-editor-control rounded-files-card border border-files-border px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted"
                        >
                          Save edited copy
                        </button>
                      </div>
                      {mirrorMessage ? (
                        <p role="alert" className="mt-2 text-product-meta text-brick">
                          {mirrorMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {loaded.descriptor.format === "docx" ? (
                    <button
                      type="button"
                      disabled={!docxText || importingDocument}
                      onClick={() =>
                        void importAsDocument(docxText ?? "", /\.docx$/i)
                      }
                      className="mt-4 rounded-files-card bg-files-cta px-3 py-2 text-product-body font-medium text-files-cta-text outline-none hover:opacity-90 disabled:opacity-50"
                    >
                      {importingDocument
                        ? "Importing…"
                        : "Import as Planevo document"}
                    </button>
                  ) : null}

                  {/*
                    A one-time conversion, so it lives here rather than shouting from a banner
                    over every markdown file. The original .md is left untouched.
                  */}
                  {loaded.descriptor.format === "markdown" ? (
                    <div className="mt-5 border-t border-files-border pt-4">
                      <h4 className="text-label uppercase text-files-text-muted">
                        Planevo document
                      </h4>
                      <p className="mt-2 text-product-body text-files-text-muted">
                        Create a rich Planevo document from this file&apos;s
                        contents. The Markdown file stays as it is.
                      </p>
                      <button
                        type="button"
                        disabled={importingDocument}
                        onClick={() =>
                          void importAsDocument(
                            typeof recoveredContent === "string"
                              ? recoveredContent
                              : "",
                            /\.md$/i,
                            "markdown",
                          )
                        }
                        className="files-editor-control mt-3 rounded-files-card border border-files-border px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted disabled:opacity-50"
                      >
                        {importingDocument
                          ? "Converting…"
                          : "Convert to Planevo document"}
                      </button>
                    </div>
                  ) : null}

                  {file.previewUrl ? (
                    <a
                      href={file.previewUrl}
                      download={file.name}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 flex items-center gap-2 text-product-body font-medium text-files-text underline underline-offset-2"
                    >
                      <Download aria-hidden="true" className="size-4" />
                      Download original
                    </a>
                  ) : null}
                </div>
              ) : null}

              {activeUtility === "notes" ? (
                <NotesTab
                  fileSourceId={file.id}
                  initial={loaded.note?.content ?? ""}
                  onSaveNote={(content) => repository.saveNote(content)}
                />
              ) : null}
              {activeUtility === "comments" &&
              file.storage_kind === "local" ? (
                <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
                  <div>
                    <Layers2
                      aria-hidden="true"
                      className="mx-auto size-5 text-files-text-muted"
                    />
                    <p className="mt-2 text-product-body font-medium text-files-text">
                      Sync to collaborate
                    </p>
                    <p className="mt-1 max-w-sm text-product-meta text-files-text-muted">
                      Local-only content stays on this device. Comments become
                      available after explicit cloud sync.
                    </p>
                  </div>
                </div>
              ) : activeUtility === "comments" ? (
                <CommentsTab loaded={loaded} onRefresh={() => void load()} />
              ) : null}
              {activeUtility === "history" ? (
                <HistoryTab
                  loaded={loaded}
                  onRestored={() => void load()}
                  onRestoreRevision={(revisionId) =>
                    repository.restoreRevision(
                      revisionId,
                      loaded.descriptor.currentVersion,
                    )
                  }
                />
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </aside>
  );
}
