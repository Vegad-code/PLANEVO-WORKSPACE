"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FileText,
  FolderOpen,
  PanelLeft,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import {
  documentFormatForFile,
  opensInDocumentEditorPanel,
} from "@planevo/core/files/document-descriptor";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import { useSidebarLayout } from "@/features/shell/sidebar-layout-context";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import {
  createFolderAction,
  createProductDocumentAction,
  deleteFolderAction,
  deleteProductFileAction,
  moveFileToFolderAction,
  registerLocalProductFileAction,
  renameFileAction,
  renameFolderAction,
  restoreProductFileAction,
  restoreProductFilesAction,
  updateProductFileTagsAction,
} from "@/app/(workspace)/files/actions";
import {
  DEFAULT_LIBRARY_WIDTH,
  getLibraryCollapsed,
  getLibraryWidth,
  setLibraryCollapsed,
} from "@/lib/files/library-prefs";
import {
  getFilesScope,
  setFilesScope,
  type FilesScope,
} from "@/lib/files/scope-prefs";
import {
  parseFileDragId,
  parseFolderDropId,
  type FolderTreeItem,
  type OwnerDisplay,
  type TagCount,
} from "./kb-contracts";
import {
  FileCrossLinkDialog,
  type FileCrossLinkTarget,
} from "./file-cross-link-dialog";
import {
  attachPickedLocalFile,
  detachLocalDocumentStateForDeletion,
  pickLocalEditableFile,
  restoreLocalDocumentStateAfterFailedDeletion,
  type LocalDocumentDeletionSnapshot,
} from "./local-file-mirror";
import { FilePreviewPanel } from "./file-preview-panel";
import {
  DocumentEditorPanel,
  type DocumentEditorMode,
} from "./document-editor-panel";
import {
  getFileEditorPreferences,
  parseDocumentEditorMode,
} from "@/lib/files/editor-prefs";
import { FilesBreadcrumbHeader } from "./files-breadcrumb-header";
import { FilesFolderCards } from "./files-folder-cards";
import { FilesKnowledgeSidebar } from "./files-knowledge-sidebar";
import {
  emptyFileListSelection,
  reduceFileListSelection,
  type FileListSelectionState,
} from "@/lib/files/file-selection";
import {
  formatBulkDeleteButtonLabel,
  formatBulkDeleteConfirmBody,
  formatBulkDeleteConfirmTitle,
  formatFilesDeletedToastMessage,
  formatFilesRestoredToastMessage,
  listBulkDeleteFileNames,
  shouldShowBulkDeleteFileList,
} from "@/lib/files/file-delete-restore";
import { FilesTable, type ProductFileItem } from "./files-table";
import { FilesUploadDropzone } from "./files-upload-dropzone";
import { FilesUploadModal } from "./files-upload-modal";
import { LibraryResizeHandle } from "./library-resize-handle";
import { uploadProductFiles } from "./product-file-uploads";
import { StorageMeter } from "./storage-meter";
// core `moveFolder` exists for folder reparent-by-drag; intentionally not wired in v1.

type FilesProductViewProps = {
  initialFiles: ProductFileItem[];
  folders: FolderTreeItem[];
  owner: OwnerDisplay;
  initialScope: FilesScope;
  workspaceId: string | null;
  usedBytes: number;
  capBytes: number;
};

type SideTab = "folders" | "tags";

const SCOPE_OPTIONS = [
  { value: "all", label: "All files" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: FilesScope; label: string }>;

const LIBRARY_TOGGLE_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as const,
};

function matchesSearch(file: ProductFileItem, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    file.name.toLowerCase().includes(needle) ||
    file.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

function byModifiedDesc(left: ProductFileItem, right: ProductFileItem): number {
  return (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

function tagCounts(files: ProductFileItem[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    for (const tag of file.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.tag.localeCompare(right.tag),
    );
}

function ScopeFilter({
  scope,
  onScopeChange,
}: {
  scope: FilesScope;
  onScopeChange: (scope: FilesScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel =
    SCOPE_OPTIONS.find((option) => option.value === scope)?.label ??
    "All files";

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="files-scope-filter"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1.5 rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
      >
        {currentLabel}
        <Icon name="chevron-down" className="size-3.5" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close filter menu"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            id="files-scope-filter"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              setOpen(false);
            }}
            className="absolute right-0 z-20 mt-2 w-48 rounded-files-card border border-files-border bg-files-surface p-1 shadow-lg"
          >
            <fieldset>
              <legend className="sr-only">Files scope</legend>
              {SCOPE_OPTIONS.map((option) => {
                const isSelected = scope === option.value;
                return (
                  <label key={option.value} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="files-scope"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => {
                        setOpen(false);
                        onScopeChange(option.value);
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text outline-none hover:bg-files-surface-muted peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-files-cta">
                      {option.label}
                      {isSelected ? (
                        <Icon
                          name="check"
                          className="size-4 text-files-text-muted"
                        />
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NamePromptDialog({
  title,
  description,
  label,
  placeholder,
  submitLabel,
  onClose,
  onSubmit,
  isPending,
}: {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="files-name-prompt-title"
      className="m-4 w-[min(100%,24rem)] rounded-files-modal border border-files-border bg-files-surface p-5 text-files-text shadow-lg backdrop:bg-files-text/40 sm:m-auto"
    >
      <h2
        id="files-name-prompt-title"
        className="text-h3 font-semibold text-files-text"
      >
        {title}
      </h2>
      <p className="mt-2 text-body text-files-text-muted">{description}</p>
      <label className="mt-4 block text-product-body text-files-text">
        {label}
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            handleSubmit();
          }}
          placeholder={placeholder}
          className="mt-2 w-full rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong"
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-files-card px-3 py-2 text-small font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !value.trim()}
          onClick={handleSubmit}
          className="rounded-files-card bg-files-cta px-4 py-2 text-small font-medium text-files-cta-text outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </Dialog>
  );
}

export function FilesEmptyState({ onUpload }: { onUpload?: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-files-card border border-dashed border-files-border bg-files-surface-muted px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-files-card border border-dashed border-files-border bg-files-surface text-files-text-muted"
      >
        <FolderOpen aria-hidden="true" className="size-10" />
      </span>
      <h2 className="mt-5 text-h2 font-semibold text-files-text">
        Your library is empty
      </h2>
      <p className="mt-2 max-w-md text-body text-files-text-muted">
        Upload a file to get started. PDFs, images, and documents all live here.
        Group them into folders and attach them to tasks and events.
      </p>
      {onUpload ? (
        <button
          type="button"
          onClick={onUpload}
          className="mt-6 rounded-files-card bg-files-cta px-4 py-2.5 text-product-body font-semibold text-files-cta-text outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
        >
          Upload or drop
        </button>
      ) : null}
    </div>
  );
}

export function FilesProductView({
  initialFiles,
  folders,
  owner,
  initialScope,
  workspaceId,
  usedBytes,
  capBytes,
}: FilesProductViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showRevealChrome } = useSidebarLayout();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isOpeningLocal, setIsOpeningLocal] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [libraryWidth, setLibraryWidthState] = useState(DEFAULT_LIBRARY_WIDTH);
  const [isLibraryResizing, setIsLibraryResizing] = useState(false);
  const [libraryWidthRestored, setLibraryWidthRestored] = useState(false);
  // Width/chrome springs only after an explicit user collapse/expand — never on
  // mount or prefs restore (those must stay instant).
  const [libraryMotionEnabled, setLibraryMotionEnabled] = useState(false);
  const [activeSideTab, setActiveSideTab] = useState<SideTab>("folders");
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const requestedFileId = searchParams.get("file");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() =>
    requestedFileId && initialFiles.some((file) => file.id === requestedFileId)
      ? requestedFileId
      : null,
  );
  const [editorMode, setEditorMode] = useState<DocumentEditorMode>(() =>
    searchParams.has("editor")
      ? parseDocumentEditorMode(searchParams.get("editor"))
      : getFileEditorPreferences().mode,
  );
  const [fileToDelete, setFileToDelete] = useState<ProductFileItem | null>(
    null,
  );
  const [filesToDelete, setFilesToDelete] = useState<ProductFileItem[] | null>(
    null,
  );
  const [bulkDeleteListOpen, setBulkDeleteListOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderTreeItem | null>(
    null,
  );
  const [listSelection, setListSelection] = useState<FileListSelectionState>(
    emptyFileListSelection,
  );
  /** Lightweight reading pane — updated by single-click, never sets ?file=. */
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [crossLink, setCrossLink] = useState<{
    files: ProductFileItem[];
    target: FileCrossLinkTarget;
  } | null>(null);
  const documentFlush = useRef<
    ((reason: "checkpoint" | "close") => Promise<void>) | null
  >(null);
  const openFileRequest = useRef(0);
  const handleDocumentFlushReady = useCallback(
    (flush: ((reason: "checkpoint" | "close") => Promise<void>) | null) => {
      documentFlush.current = flush;
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const storedScope = getFilesScope();
    if (storedScope === initialScope) return;
    if (storedScope === "workspace" && !workspaceId) {
      setFilesScope("all");
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    if (storedScope === "workspace") next.set("scope", "workspace");
    else next.delete("scope");
    const query = next.toString();
    router.replace(query ? `/files?${query}` : "/files", { scroll: false });
  }, [initialScope, router, searchParams, workspaceId]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      const nextFileId = searchParams.get("file");
      setSelectedFileId(
        nextFileId && initialFiles.some((file) => file.id === nextFileId)
          ? nextFileId
          : null,
      );
      setEditorMode(
        searchParams.has("editor")
          ? parseDocumentEditorMode(searchParams.get("editor"))
          : getFileEditorPreferences().mode,
      );
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [initialFiles, searchParams]);

  // Restore before paint so the first painted frame matches the loading
  // skeleton. Do not arm width motion here — that was the hard-refresh open
  // spring (DEFAULT → stored width). Re-write the cookie so SSR loading HTML
  // stays in sync if localStorage was the only source.
  useLayoutEffect(() => {
    const collapsed = getLibraryCollapsed();
    setSidebarCollapsed(collapsed);
    setLibraryWidthState(getLibraryWidth());
    setLibraryWidthRestored(true);
    setLibraryCollapsed(collapsed);
  }, []);

  function setSidebarCollapsedFromUser(collapsed: boolean) {
    setLibraryMotionEnabled(true);
    setSidebarCollapsed(collapsed);
  }

  useEffect(() => {
    if (!libraryWidthRestored) return;
    setLibraryCollapsed(sidebarCollapsed);
  }, [libraryWidthRestored, sidebarCollapsed]);

  function handleLibraryWidthChange(nextWidth: number) {
    setLibraryWidthState(nextWidth);
  }

  const tags = useMemo(() => tagCounts(initialFiles), [initialFiles]);

  const visibleFiles = useMemo(() => {
    const filtered = initialFiles.filter((file) => {
      if (!matchesSearch(file, search)) return false;
      if (activeSideTab === "tags") {
        return selectedTag === null || file.tags.includes(selectedTag);
      }
      return selectedFolderId === null || file.folder_id === selectedFolderId;
    });
    return filtered.sort(byModifiedDesc);
  }, [activeSideTab, initialFiles, search, selectedFolderId, selectedTag]);

  const selectedFile = selectedFileId
    ? (initialFiles.find((file) => file.id === selectedFileId) ?? null)
    : null;
  const previewFile = previewFileId
    ? (initialFiles.find((file) => file.id === previewFileId) ?? null)
    : null;

  const selectedFormat = selectedFile
    ? documentFormatForFile({
        name: selectedFile.name,
        mimeType: selectedFile.mime_type,
        pageId: selectedFile.page_id,
      })
    : null;

  function replaceFilesUrl(update: {
    fileId?: string | null;
    editor?: DocumentEditorMode | null;
    scope?: FilesScope;
  }) {
    const next = new URLSearchParams(searchParams.toString());
    if (update.scope) {
      if (update.scope === "workspace") next.set("scope", "workspace");
      else next.delete("scope");
    }
    if (update.fileId !== undefined) {
      if (update.fileId) next.set("file", update.fileId);
      else next.delete("file");
    }
    if (update.editor !== undefined) {
      if (update.editor) next.set("editor", update.editor);
      else next.delete("editor");
    }
    const query = next.toString();
    router.replace(query ? `/files?${query}` : "/files", { scroll: false });
  }

  /** Open file in the editor / preview pane. Owns ?file= URL. */
  async function openFile(
    file: ProductFileItem,
    options?: { toggleSame?: boolean },
  ) {
    const toggleSame = options?.toggleSame ?? true;
    const request = openFileRequest.current + 1;
    openFileRequest.current = request;
    const flush = documentFlush.current;
    try {
      if (flush) await flush("close");
    } catch (cause) {
      toast(
        cause instanceof Error
          ? cause.message
          : "Planevo could not finish saving the open DOCX.",
        { tone: "error" },
      );
      return;
    }
    if (request !== openFileRequest.current) return;

    setPreviewFileId(file.id);
    if (file.id === selectedFileId) {
      if (!toggleSame) return;
      setSelectedFileId(null);
      setEditorMode(getFileEditorPreferences().mode);
      replaceFilesUrl({ fileId: null, editor: null });
      return;
    }
    setSelectedFileId(file.id);
    const preferredMode = getFileEditorPreferences().mode;
    setEditorMode(preferredMode);
    replaceFilesUrl({ fileId: file.id, editor: preferredMode });
  }

  function closeFile() {
    openFileRequest.current += 1;
    documentFlush.current = null;
    setSelectedFileId(null);
    setPreviewFileId(null);
    setEditorMode(getFileEditorPreferences().mode);
    replaceFilesUrl({ fileId: null, editor: null });
  }

  function changeEditorMode(mode: DocumentEditorMode) {
    setEditorMode(mode);
    replaceFilesUrl({ fileId: selectedFileId, editor: mode });
  }

  function changeScope(scope: FilesScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" });
      return;
    }
    setFilesScope(scope);
    setListSelection(emptyFileListSelection());
    setPreviewFileId(null);
    replaceFilesUrl({ scope });
  }

  function handleSelectFolder(folderId: string | null) {
    setActiveSideTab("folders");
    setSelectedTag(null);
    setSelectedFolderId(folderId);
    setListSelection(emptyFileListSelection());
    setPreviewFileId(null);
  }

  function handleSelectTag(tag: string | null) {
    setSelectedTag(tag);
    setListSelection(emptyFileListSelection());
    setPreviewFileId(null);
  }

  function handleUploadComplete() {
    setIsUploading(false);
    router.refresh();
  }

  async function handleDroppedFiles(files: File[]) {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploadedCount = await uploadProductFiles(files);
      toast(
        uploadedCount === 1
          ? "File uploaded"
          : `${uploadedCount} files uploaded`,
      );
      handleUploadComplete();
    } catch (cause) {
      setIsUploading(false);
      toast(cause instanceof Error ? cause.message : "Upload failed.", {
        tone: "error",
      });
    }
  }

  async function handleOpenLocalFile() {
    setIsOpeningLocal(true);
    try {
      const picked = await pickLocalEditableFile();
      const result = await registerLocalProductFileAction({
        name: picked.file.name,
        mimeType: picked.file.type || null,
        sizeBytes: picked.file.size,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      try {
        await attachPickedLocalFile(result.data.fileSourceId, picked);
      } catch (cause) {
        await deleteProductFileAction({
          fileSourceId: result.data.fileSourceId,
        });
        throw cause;
      }
      const preferredMode = getFileEditorPreferences().mode;
      setSelectedFileId(result.data.fileSourceId);
      setEditorMode(preferredMode);
      replaceFilesUrl({
        fileId: result.data.fileSourceId,
        editor: preferredMode,
      });
      toast(
        picked.file.name.toLowerCase().endsWith(".docx")
          ? "DOCX opened. Edits save back to this file automatically."
          : "Local file opened. Its content stays on this device.",
      );
      router.refresh();
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError") {
        toast(
          cause instanceof Error
            ? cause.message
            : "Could not open the local file.",
          { tone: "error" },
        );
      }
    } finally {
      setIsOpeningLocal(false);
    }
  }

  const handleCreateFolder = useCallback(
    async (name: string, parentId: string | null): Promise<boolean> => {
      const result = await createFolderAction({ name, parentId });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return false;
      }
      router.refresh();
      return true;
    },
    [router],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      const result = await renameFolderAction({ folderId, name });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return false;
      }
      router.refresh();
      return true;
    },
    [router],
  );

  function handleConfirmDeleteFolder() {
    const folder = folderToDelete;
    if (!folder) return;
    startTransition(async () => {
      const result = await deleteFolderAction({ folderId: folder.id });
      setFolderToDelete(null);
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
      toast(`Folder “${folder.name}” deleted`);
      router.refresh();
    });
  }

  function handleMoveFileToFolder(fileId: string, folderId: string | null) {
    handleBulkMoveToFolder([fileId], folderId);
  }

  function handleBulkMoveToFolder(fileIds: string[], folderId: string | null) {
    if (fileIds.length === 0) return;
    const needsMove = fileIds.filter((fileId) => {
      const file = initialFiles.find((candidate) => candidate.id === fileId);
      return !file || (file.folder_id ?? null) !== folderId;
    });
    if (needsMove.length === 0) return;
    startTransition(async () => {
      const result = await moveFileToFolderAction({
        fileIds: needsMove,
        folderId,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast(
        folderId
          ? needsMove.length === 1
            ? "Moved to folder"
            : `Moved ${needsMove.length} files`
          : needsMove.length === 1
            ? "Removed from folder"
            : `Removed ${needsMove.length} files from folder`,
      );
      setListSelection(emptyFileListSelection());
      router.refresh();
    });
  }

  function downloadFiles(files: ProductFileItem[]) {
    for (const file of files) {
      if (!file.previewUrl) continue;
      const anchor = document.createElement("a");
      anchor.href = file.previewUrl;
      anchor.download = file.name;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  const handleRenameFile = useCallback(
    async (name: string): Promise<boolean> => {
      if (!selectedFileId) return false;
      const result = await renameFileAction({
        fileSourceId: selectedFileId,
        name,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return false;
      }
      router.refresh();
      return true;
    },
    [router, selectedFileId],
  );

  function handleUpdateTags(file: ProductFileItem, nextTags: string[]) {
    startTransition(async () => {
      const result = await updateProductFileTagsAction({
        fileSourceId: file.id,
        tags: nextTags,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      router.refresh();
    });
  }

  async function deleteOneFile(
    file: ProductFileItem,
  ): Promise<LocalDocumentDeletionSnapshot | null> {
    let localState: LocalDocumentDeletionSnapshot;
    try {
      localState = await detachLocalDocumentStateForDeletion(file.id);
    } catch {
      toast(
        "Could not clear this file from browser recovery storage. The file was not deleted.",
        { tone: "error" },
      );
      return null;
    }
    const result = await deleteProductFileAction({ fileSourceId: file.id });
    if (!result.ok) {
      try {
        await restoreLocalDocumentStateAfterFailedDeletion(localState);
      } catch {
        toast(
          "The file is still in Planevo, but its browser recovery state could not be restored.",
          { tone: "error" },
        );
      }
      toast(result.error, { tone: "error" });
      return null;
    }
    if (selectedFileId === file.id) closeFile();
    return localState;
  }

  function offerRestoreDeletedFiles(input: {
    files: readonly ProductFileItem[];
    snapshots: readonly LocalDocumentDeletionSnapshot[];
  }) {
    const fileSourceIds = input.files.map((file) => file.id);
    const snapshotsById = new Map(
      input.snapshots.map((snapshot) => [snapshot.fileSourceId, snapshot]),
    );
    toast(formatFilesDeletedToastMessage(fileSourceIds.length), {
      action: {
        label: "Restore",
        onClick: () => {
          startTransition(async () => {
            const result =
              fileSourceIds.length === 1
                ? await restoreProductFileAction({
                    fileSourceId: fileSourceIds[0]!,
                  }).then((single) =>
                    single.ok
                      ? {
                          ok: true as const,
                          data: { restoredIds: fileSourceIds },
                        }
                      : single,
                  )
                : await restoreProductFilesAction({ fileSourceIds });
            if (!result.ok) {
              toast(result.error, { tone: "error" });
              return;
            }
            for (const restoredId of result.data.restoredIds) {
              const snapshot = snapshotsById.get(restoredId);
              if (!snapshot) continue;
              try {
                await restoreLocalDocumentStateAfterFailedDeletion(snapshot);
              } catch {
                // Soft-delete restore succeeded in Postgres; local drafts are best-effort.
              }
            }
            toast(
              formatFilesRestoredToastMessage(result.data.restoredIds.length),
            );
            router.refresh();
          });
        },
      },
    });
  }

  function handleConfirmDelete() {
    const file = fileToDelete;
    if (!file) return;
    startTransition(async () => {
      const snapshot = await deleteOneFile(file);
      setFileToDelete(null);
      if (!snapshot) return;
      setListSelection((prev) =>
        reduceFileListSelection(prev, {
          type: "set",
          ids: prev.selectedIds.filter((id) => id !== file.id),
        }),
      );
      offerRestoreDeletedFiles({ files: [file], snapshots: [snapshot] });
      router.refresh();
    });
  }

  function handleConfirmBulkDelete() {
    const files = filesToDelete;
    if (!files || files.length === 0) return;
    startTransition(async () => {
      setBulkDeleteProgress({ completed: 0, total: files.length });
      const deleted: ProductFileItem[] = [];
      const snapshots: LocalDocumentDeletionSnapshot[] = [];
      for (const file of files) {
        const snapshot = await deleteOneFile(file);
        if (!snapshot) break;
        deleted.push(file);
        snapshots.push(snapshot);
        setBulkDeleteProgress({
          completed: deleted.length,
          total: files.length,
        });
      }
      const deletedIds = new Set(deleted.map((file) => file.id));
      const remaining = files.filter((file) => !deletedIds.has(file.id));
      setFilesToDelete(remaining.length > 0 ? remaining : null);
      setBulkDeleteProgress(null);
      if (remaining.length === 0) setBulkDeleteListOpen(false);
      setListSelection((prev) =>
        reduceFileListSelection(prev, {
          type: "set",
          ids: prev.selectedIds.filter((id) => !deletedIds.has(id)),
        }),
      );
      if (deleted.length === 0) return;
      offerRestoreDeletedFiles({ files: deleted, snapshots });
      router.refresh();
    });
  }

  function handleCreateDocument(title: string) {
    startTransition(async () => {
      const result = await createProductDocumentAction({ title });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      setCreateDocumentOpen(false);
      toast("Document created");
      setSelectedFileId(result.data.fileSourceId);
      const preferredMode = getFileEditorPreferences().mode;
      setEditorMode(preferredMode);
      replaceFilesUrl({
        fileId: result.data.fileSourceId,
        editor: preferredMode,
      });
      router.refresh();
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const fileId = parseFileDragId(String(active.id));
    if (!fileId) return;
    const target = parseFolderDropId(String(over.id));
    if (target === undefined) return;
    handleMoveFileToFolder(fileId, target);
  }

  return (
    <DndContext
      id="files-kb-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <section
        data-product="files"
        aria-label="Files"
        aria-busy={isPending || isUploading}
        className={cn(
          "files-product-ui flex h-full w-full overflow-hidden",
          showRevealChrome && "md:pl-[length:var(--sidebar-reveal-safe-inset)]",
        )}
      >
        {/*
          Plain aside (not motion): restoring width while libraryWidthRestored
          flipped true armed the shell spring (DEFAULT → stored) on every load.
          Static width + CSS transition only after user toggle.
          Until restore, library-rail-boot uses the beforeInteractive script.
        */}
        <aside
          aria-hidden={sidebarCollapsed}
          inert={sidebarCollapsed}
          className={cn(
            "hidden shrink-0 overflow-hidden bg-files-bg lg:flex lg:flex-col",
            !libraryWidthRestored && "library-rail-boot",
            sidebarCollapsed && "pointer-events-none",
          )}
          style={
            libraryWidthRestored
              ? {
                  width: sidebarCollapsed ? 0 : libraryWidth,
                  transition:
                    libraryMotionEnabled &&
                    !isLibraryResizing &&
                    !prefersReducedMotion
                      ? "width var(--sidebar-motion-duration-enter) var(--sidebar-motion-ease-out)"
                      : "none",
                }
              : undefined
          }
        >
          <div
            className="relative flex h-full shrink-0 flex-col border-r border-files-border"
            style={{ width: libraryWidth }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FilesKnowledgeSidebar
                activeTab={activeSideTab}
                onTabChange={(tab) => {
                  setActiveSideTab(tab);
                  setListSelection(emptyFileListSelection());
                  setPreviewFileId(null);
                }}
                search={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setListSelection(emptyFileListSelection());
                  setPreviewFileId(null);
                }}
                onCollapse={() => setSidebarCollapsedFromUser(true)}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={(folderId) =>
                  setFolderToDelete(
                    folders.find((folder) => folder.id === folderId) ?? null,
                  )
                }
                tags={tags}
                selectedTag={selectedTag}
                onSelectTag={handleSelectTag}
              />
            </div>
            <div className="relative w-full shrink-0 bg-files-bg shadow-[inset_0_1px_0_0_var(--color-files-border-strong)]">
              <div className="p-3">
                <StorageMeter
                  usedBytes={usedBytes}
                  capBytes={capBytes}
                  files={initialFiles.filter(
                    (file) => file.storage_kind !== "local",
                  )}
                  onDeleteFile={(file) => {
                    const match = initialFiles.find(
                      (candidate) => candidate.id === file.id,
                    );
                    if (match) setFileToDelete(match);
                  }}
                />
              </div>
            </div>
            <LibraryResizeHandle
              width={libraryWidth}
              onWidthChange={handleLibraryWidthChange}
              onCollapse={() => setSidebarCollapsedFromUser(true)}
              onResizeStart={() => setIsLibraryResizing(true)}
              onResizeEnd={() => setIsLibraryResizing(false)}
            />
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 overflow-hidden bg-files-bg">
          <div
            className={cn(
              "min-w-0 flex-1 flex-col overflow-y-auto bg-files-bg",
              // Full editor floats as glass over the library — keep cards visible for frost.
              selectedFile && editorMode === "full"
                ? "pointer-events-none flex opacity-55"
                : "flex",
            )}
          >
            <div className="sticky top-0 z-10 bg-files-bg/95 px-6 pt-4 pb-3 backdrop-blur-sm lg:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AnimatePresence initial={false}>
                    {libraryWidthRestored && sidebarCollapsed ? (
                      <motion.button
                        key="show-library"
                        type="button"
                        aria-label="Show library panel"
                        onClick={() => setSidebarCollapsedFromUser(false)}
                        initial={
                          prefersReducedMotion || !libraryMotionEnabled
                            ? false
                            : { opacity: 0, scale: 0.92 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          prefersReducedMotion
                            ? undefined
                            : { opacity: 0, scale: 0.92 }
                        }
                        transition={
                          prefersReducedMotion || !libraryMotionEnabled
                            ? { duration: 0 }
                            : LIBRARY_TOGGLE_TRANSITION
                        }
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                      >
                        <PanelLeft aria-hidden="true" className="size-4" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                  {activeSideTab === "folders" ? (
                    <FilesBreadcrumbHeader
                      folders={folders}
                      selectedFolderId={selectedFolderId}
                      onSelectFolder={handleSelectFolder}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-h3 font-semibold text-files-text">
                      Tags
                      {selectedTag ? (
                        <Badge asChild variant="secondary">
                          <button
                            type="button"
                            onClick={() => handleSelectTag(null)}
                            className="outline-none focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-files-cta"
                          >
                            #{selectedTag}
                            <X aria-hidden="true" className="size-3" />
                          </button>
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ScopeFilter
                    scope={initialScope}
                    onScopeChange={changeScope}
                  />
                  <button
                    type="button"
                    disabled={isOpeningLocal}
                    onClick={() => void handleOpenLocalFile()}
                    className="flex items-center gap-1.5 rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileText aria-hidden="true" className="size-4" />
                    {isOpeningLocal ? "Opening…" : "Open from computer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateDocumentOpen(true)}
                    className="flex items-center gap-1.5 rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    New doc
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setUploadModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-files-card bg-files-cta px-3 py-2 text-product-body font-semibold text-files-cta-text outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload aria-hidden="true" className="size-4" />
                    Upload
                  </button>
                </div>
              </div>
            </div>

            <FilesUploadDropzone
              onUploadFiles={handleDroppedFiles}
              isUploading={isUploading}
            >
              <div className="px-6 pb-16 pt-2 lg:px-8">
                {activeSideTab === "folders" ? (
                  <FilesFolderCards
                    folders={folders}
                    files={initialFiles}
                    parentId={selectedFolderId}
                    onOpenFolder={handleSelectFolder}
                  />
                ) : null}

                <section
                  className="mt-10"
                  aria-label="Files"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setListSelection(emptyFileListSelection());
                    }
                  }}
                >
                  <h2 className="text-product-body font-medium text-files-text-muted">
                    Files
                  </h2>
                  <div className="mt-3">
                    {initialFiles.length === 0 ? (
                      <FilesEmptyState
                        onUpload={() => setUploadModalOpen(true)}
                      />
                    ) : visibleFiles.length === 0 ? (
                      <p className="py-10 text-center text-product-body text-files-text-muted">
                        No files match this view.
                      </p>
                    ) : (
                      <FilesTable
                        files={visibleFiles}
                        owner={owner}
                        folders={folders}
                        openedFileId={selectedFileId}
                        previewFileId={previewFileId}
                        selection={listSelection}
                        onSelectionChange={(intent) =>
                          setListSelection((prev) =>
                            reduceFileListSelection(prev, intent),
                          )
                        }
                        onOpenFile={(file, options) => void openFile(file, options)}
                        onDeleteFile={setFileToDelete}
                        onAttachToTask={(files) =>
                          setCrossLink({ files, target: "task" })
                        }
                        onLinkToEvent={(files) =>
                          setCrossLink({ files, target: "event" })
                        }
                        onMoveFileToFolder={handleMoveFileToFolder}
                        onBulkDownload={downloadFiles}
                        onBulkMoveToFolder={(files, folderId) =>
                          handleBulkMoveToFolder(
                            files.map((file) => file.id),
                            folderId,
                          )
                        }
                        onBulkDelete={(files) => {
                          setBulkDeleteListOpen(false);
                          setBulkDeleteProgress(null);
                          setFilesToDelete(files);
                        }}
                        bulkDeleteBusy={
                          isPending &&
                          Boolean(filesToDelete && filesToDelete.length > 1)
                        }
                      />
                    )}
                  </div>
                </section>
              </div>
            </FilesUploadDropzone>
          </div>

          {selectedFile &&
          selectedFormat &&
          opensInDocumentEditorPanel(selectedFormat) ? (
            <DocumentEditorPanel
              key={selectedFile.id}
              file={selectedFile}
              mode={editorMode}
              onModeChange={changeEditorMode}
              onClose={closeFile}
              onUpdateTags={(nextTags) =>
                handleUpdateTags(selectedFile, nextTags)
              }
              onRenameFile={handleRenameFile}
              onImportedDocument={(fileSourceId) => {
                setSelectedFileId(fileSourceId);
                setPreviewFileId(fileSourceId);
                const preferredMode = getFileEditorPreferences().mode;
                setEditorMode(preferredMode);
                replaceFilesUrl({ fileId: fileSourceId, editor: preferredMode });
                router.refresh();
              }}
              onFileSynchronized={() => router.refresh()}
              onFlushReady={handleDocumentFlushReady}
            />
          ) : selectedFile ? (
            <FilePreviewPanel
              key={`open:${selectedFile.id}`}
              file={selectedFile}
              onClose={closeFile}
              onUpdateTags={(nextTags) =>
                handleUpdateTags(selectedFile, nextTags)
              }
              onRenameFile={handleRenameFile}
            />
          ) : previewFile ? (
            <FilePreviewPanel
              key={`peek:${previewFile.id}`}
              file={previewFile}
              onClose={() => setPreviewFileId(null)}
              onUpdateTags={(nextTags) =>
                handleUpdateTags(previewFile, nextTags)
              }
              onRenameFile={handleRenameFile}
            />
          ) : null}
        </div>

        <FilesUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUploadingChange={setIsUploading}
          onUploadComplete={() => {
            toast("Files uploaded");
            handleUploadComplete();
          }}
        />

        {createDocumentOpen ? (
          <NamePromptDialog
            title="Create document"
            description="Start a new Planevo document. It appears in your library and opens in Workspace."
            label="Document title"
            placeholder="Untitled"
            submitLabel="Create document"
            isPending={isPending}
            onClose={() => setCreateDocumentOpen(false)}
            onSubmit={handleCreateDocument}
          />
        ) : null}

        {crossLink && crossLink.files.length > 0 ? (
          <FileCrossLinkDialog
            key={`${crossLink.files.map((file) => file.id).join(",")}-${crossLink.target}`}
            files={crossLink.files}
            target={crossLink.target}
            onClose={() => setCrossLink(null)}
          />
        ) : null}

        {fileToDelete ? (
          <Dialog
            open
            onClose={() => {
              if (isPending) return;
              setFileToDelete(null);
            }}
            labelledBy="delete-file-title"
            className="m-4 w-[min(100%,24rem)] rounded-files-modal border border-files-border bg-files-surface p-5 text-files-text shadow-lg backdrop:bg-files-text/40 sm:m-auto"
          >
            <h2
              id="delete-file-title"
              className="text-h3 font-semibold text-files-text"
            >
              Delete “{fileToDelete.name}”?
            </h2>
            <p className="mt-2 text-body text-files-text-muted">
              {formatBulkDeleteConfirmBody(1)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setFileToDelete(null)}
                className="rounded-files-card px-3 py-2 text-small font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
                animate={
                  isPending && !prefersReducedMotion
                    ? { opacity: [1, 0.55, 1] }
                    : { opacity: 1 }
                }
                transition={
                  isPending && !prefersReducedMotion
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.15 }
                }
                className="rounded-files-card bg-brick px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed"
              >
                {formatBulkDeleteButtonLabel({
                  count: 1,
                  isDeleting: isPending,
                })}
              </motion.button>
            </div>
          </Dialog>
        ) : null}

        {filesToDelete && filesToDelete.length > 0 ? (
          <Dialog
            open
            onClose={() => {
              if (isPending) return;
              setBulkDeleteListOpen(false);
              setBulkDeleteProgress(null);
              setFilesToDelete(null);
            }}
            labelledBy="delete-files-title"
            className="m-4 w-[min(100%,24rem)] rounded-files-modal border border-files-border bg-files-surface p-5 text-files-text shadow-lg backdrop:bg-files-text/40 sm:m-auto"
          >
            <h2
              id="delete-files-title"
              className="text-h3 font-semibold text-files-text"
            >
              {formatBulkDeleteConfirmTitle(filesToDelete)}
            </h2>
            <p className="mt-2 text-body text-files-text-muted">
              {formatBulkDeleteConfirmBody(filesToDelete.length)}
            </p>
            {shouldShowBulkDeleteFileList(filesToDelete.length) ? (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={bulkDeleteListOpen}
                  onClick={() => setBulkDeleteListOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-left text-small font-medium text-files-text outline-none hover:bg-files-surface focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
                >
                  <span>
                    {bulkDeleteListOpen
                      ? "Hide file list"
                      : `Show ${filesToDelete.length} files`}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 text-files-text-muted transition-transform duration-150 motion-reduce:transition-none ${
                      bulkDeleteListOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {bulkDeleteListOpen ? (
                    <motion.ul
                      key="bulk-delete-file-list"
                      initial={{
                        height: 0,
                        opacity: 0,
                      }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.18,
                      }}
                      className="mt-2 max-h-40 overflow-auto rounded-files-card border border-files-border bg-files-surface px-3 py-2"
                    >
                      {listBulkDeleteFileNames(filesToDelete).map(
                        (name, index) => (
                          <li
                            key={`${filesToDelete[index]!.id}-${name}`}
                            className="truncate py-1 text-small text-files-text"
                          >
                            {name}
                          </li>
                        ),
                      )}
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setBulkDeleteListOpen(false);
                  setBulkDeleteProgress(null);
                  setFilesToDelete(null);
                }}
                className="rounded-files-card px-3 py-2 text-small font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                disabled={isPending}
                onClick={handleConfirmBulkDelete}
                animate={
                  isPending && !prefersReducedMotion
                    ? { opacity: [1, 0.55, 1], scale: [1, 0.98, 1] }
                    : { opacity: 1, scale: 1 }
                }
                transition={
                  isPending && !prefersReducedMotion
                    ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.15 }
                }
                className="rounded-files-card bg-brick px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed"
              >
                {formatBulkDeleteButtonLabel({
                  count: filesToDelete.length,
                  isDeleting: isPending,
                  completed: bulkDeleteProgress?.completed ?? 0,
                })}
              </motion.button>
            </div>
          </Dialog>
        ) : null}

        {folderToDelete ? (
          <Dialog
            open
            onClose={() => setFolderToDelete(null)}
            labelledBy="delete-folder-title"
            className="m-4 w-[min(100%,24rem)] rounded-files-modal border border-files-border bg-files-surface p-5 text-files-text shadow-lg backdrop:bg-files-text/40 sm:m-auto"
          >
            <h2
              id="delete-folder-title"
              className="text-h3 font-semibold text-files-text"
            >
              Delete “{folderToDelete.name}”?
            </h2>
            <p className="mt-2 text-body text-files-text-muted">
              This removes the folder and any subfolders. Files inside are kept
              — they just become unfiled. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="rounded-files-card px-3 py-2 text-small font-medium text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDeleteFolder}
                className="rounded-files-card bg-brick px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete folder
              </button>
            </div>
          </Dialog>
        ) : null}
      </section>
    </DndContext>
  );
}
