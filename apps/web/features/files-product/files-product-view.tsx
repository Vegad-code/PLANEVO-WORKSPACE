"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, SlidersHorizontal } from "lucide-react";
import {
  matchesFileFilterTab,
  type FileFilterTab,
} from "@planevo/core/types/files";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import {
  deleteProductFileAction,
  updateProductFileTagsAction,
} from "@/app/(workspace)/files/actions";
import {
  getFilesScope,
  setFilesScope,
  type FilesScope,
} from "@/lib/files/scope-prefs";
import {
  FileCrossLinkDialog,
  type FileCrossLinkTarget,
} from "./file-cross-link-dialog";
import { FilePreviewPanel } from "./file-preview-panel";
import { FilesActionRow } from "./files-action-row";
import { FilesCabinetHeader } from "./files-cabinet-header";
import { FilesFilterTabs } from "./files-filter-tabs";
import { FilesTable, type ProductFileItem } from "./files-table";
import { FilesUploadDropzone } from "./files-upload-dropzone";
import { FolderChips } from "./folder-chips";
import { uploadProductFiles } from "./product-file-uploads";
import { StorageMeter } from "./storage-meter";

type FilesProductViewProps = {
  initialFiles: ProductFileItem[];
  initialScope: FilesScope;
  workspaceId: string | null;
  firstName: string | null;
  usedBytes: number;
  capBytes: number;
};

const SCOPE_OPTIONS = [
  { value: "all", label: "All files" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: FilesScope; label: string }>;

function matchesSearch(file: ProductFileItem, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    file.name.toLowerCase().includes(needle) ||
    file.tags.some((tag) => tag.toLowerCase().includes(needle))
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

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="files-scope-filter"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Filter
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
            className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-border bg-paper p-1"
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
                    <span className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none hover:bg-surface-raised peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                      {option.label}
                      {isSelected ? (
                        <Icon name="check" className="size-4 text-text-secondary" />
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

export function FilesEmptyState() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-card border border-dashed border-border bg-paper text-text-muted"
      >
        <FolderOpen aria-hidden="true" className="size-10" />
      </span>
      <h2 className="mt-5 text-h2">Your file cabinet is empty</h2>
      <p className="mt-2 max-w-md text-body text-text-secondary">
        Upload a file or drop one anywhere on this page. PDFs, images, and
        documents all live here — attach them to tasks and events when you need
        them.
      </p>
    </div>
  );
}

export function FilesProductView({
  initialFiles,
  initialScope,
  workspaceId,
  firstName,
  usedBytes,
  capBytes,
}: FilesProductViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<FileFilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ProductFileItem | null>(null);
  const [crossLink, setCrossLink] = useState<{
    file: ProductFileItem;
    target: FileCrossLinkTarget;
  } | null>(null);

  useEffect(() => {
    const storedScope = getFilesScope();
    if (storedScope === initialScope) return;
    if (storedScope === "workspace" && !workspaceId) {
      setFilesScope("all");
      return;
    }
    router.replace(storedScope === "workspace" ? "/files?scope=workspace" : "/files");
  }, [initialScope, router, workspaceId]);

  const folders = useMemo(() => {
    const distinct = new Set<string>();
    for (const file of initialFiles) {
      if (file.folder) distinct.add(file.folder);
    }
    return [...distinct].sort((left, right) => left.localeCompare(right));
  }, [initialFiles]);

  const visibleFiles = initialFiles.filter(
    (file) =>
      matchesFileFilterTab(file.mime_type, activeTab) &&
      matchesSearch(file, search) &&
      (selectedFolder === null || file.folder === selectedFolder),
  );

  const selectedFile = selectedFileId
    ? initialFiles.find((file) => file.id === selectedFileId) ?? null
    : null;

  function changeScope(scope: FilesScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" });
      return;
    }
    setFilesScope(scope);
    router.push(scope === "workspace" ? "/files?scope=workspace" : "/files");
  }

  function handleUploadFiles(files: File[]) {
    setIsUploading(true);
    void uploadProductFiles(files)
      .then((uploadedCount) => {
        toast(
          uploadedCount === 1 ? "File uploaded" : `${uploadedCount} files uploaded`,
        );
        router.refresh();
      })
      .catch((cause) => {
        toast(
          cause instanceof Error ? cause.message : "Could not upload the files.",
          { tone: "error" },
        );
      })
      .finally(() => setIsUploading(false));
  }

  function handleUpdateTags(file: ProductFileItem, tags: string[]) {
    startTransition(async () => {
      const result = await updateProductFileTagsAction({
        fileSourceId: file.id,
        tags,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    const file = fileToDelete;
    if (!file) return;
    startTransition(async () => {
      const result = await deleteProductFileAction({ fileSourceId: file.id });
      setFileToDelete(null);
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      if (selectedFileId === file.id) setSelectedFileId(null);
      toast("File deleted");
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="files-product-title"
      aria-busy={isPending || isUploading}
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <FilesCabinetHeader firstName={firstName} scope={initialScope} />
        <div className="flex flex-wrap items-center gap-2">
          <FilesActionRow
            onUploadFiles={handleUploadFiles}
            isUploading={isUploading}
          />
          <ScopeFilter scope={initialScope} onScopeChange={changeScope} />
        </div>
      </header>

      {folders.length > 0 ? (
        <div className="mb-5">
          <FolderChips
            folders={folders}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />
        </div>
      ) : null}

      <div className="mb-4">
        <FilesFilterTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-card border border-border bg-paper lg:flex-row">
        <FilesUploadDropzone
          onUploadFiles={handleUploadFiles}
          isUploading={isUploading}
        >
          <div className="min-w-0 flex-1">
            {initialFiles.length === 0 ? (
              <div className="p-4">
                <FilesEmptyState />
              </div>
            ) : visibleFiles.length === 0 ? (
              <p className="px-4 py-10 text-center text-product-body text-text-muted">
                No files match this filter.
              </p>
            ) : (
              <FilesTable
                files={visibleFiles}
                selectedFileId={selectedFileId}
                onSelectFile={(file) =>
                  setSelectedFileId(file.id === selectedFileId ? null : file.id)
                }
                onDeleteFile={setFileToDelete}
                onAttachToTask={(file) => setCrossLink({ file, target: "task" })}
                onLinkToEvent={(file) => setCrossLink({ file, target: "event" })}
              />
            )}
          </div>
        </FilesUploadDropzone>
        {selectedFile ? (
          <FilePreviewPanel
            key={selectedFile.id}
            file={selectedFile}
            onClose={() => setSelectedFileId(null)}
            onUpdateTags={(tags) => handleUpdateTags(selectedFile, tags)}
          />
        ) : null}
      </div>

      <div className="mt-5 max-w-sm">
        <StorageMeter usedBytes={usedBytes} capBytes={capBytes} />
      </div>

      {crossLink ? (
        <FileCrossLinkDialog
          key={`${crossLink.file.id}-${crossLink.target}`}
          file={crossLink.file}
          target={crossLink.target}
          onClose={() => setCrossLink(null)}
        />
      ) : null}

      {fileToDelete ? (
        <Dialog
          open
          onClose={() => setFileToDelete(null)}
          labelledBy="delete-file-title"
          className="m-4 w-[min(100%,24rem)] rounded-2xl border border-border bg-surface-raised p-5 text-ink shadow-lg backdrop:bg-ink/30 sm:m-auto"
        >
          <h2 id="delete-file-title" className="text-h3 font-medium">
            Delete “{fileToDelete.name}”?
          </h2>
          <p className="mt-2 text-body text-text-secondary">
            This permanently removes the file from storage and any tasks or
            events it is attached to. This can&apos;t be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFileToDelete(null)}
              className="rounded-lg px-3 py-2 text-small font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmDelete}
              className="rounded-lg bg-brick px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete file
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
