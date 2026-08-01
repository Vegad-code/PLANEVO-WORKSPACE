"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderInput,
  GripVertical,
  Link2,
  MoreHorizontal,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { DropdownMenu } from "radix-ui";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import type { FileSourceWithMeta } from "@planevo/core/queries/product-files";
import { mimeFamily } from "@planevo/core/types/files";
import { Badge } from "@/components/ui/badge";
import {
  fileListSelectAllIntent,
  fileListSelectAllState,
  isFileListSelected,
  type FileListSelectionIntent,
  type FileListSelectionState,
} from "@/lib/files/file-selection";
import { fileDragId, type FolderTreeItem, type OwnerDisplay } from "./kb-contracts";
import { formatBytes } from "./storage-meter";

export type ProductFileItem = FileSourceWithMeta & {
  previewUrl: string | null;
};

type FilesTableProps = {
  files: ProductFileItem[];
  owner: OwnerDisplay;
  folders: FolderTreeItem[];
  /** File open in the heavy editor (URL ?file=). Distinct from checkbox multi-select. */
  openedFileId: string | null;
  /** File shown in the lightweight reading/preview pane. */
  previewFileId: string | null;
  selection: FileListSelectionState;
  onSelectionChange: (intent: FileListSelectionIntent) => void;
  /** Heavy editor open/toggle — row click / Enter (+ document flush). */
  onOpenFile: (
    file: ProductFileItem,
    options?: { toggleSame?: boolean },
  ) => void;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (files: ProductFileItem[]) => void;
  onLinkToEvent: (files: ProductFileItem[]) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
  onBulkDownload: (files: ProductFileItem[]) => void;
  onBulkMoveToFolder: (files: ProductFileItem[], folderId: string | null) => void;
  onBulkDelete?: (files: ProductFileItem[]) => void;
  /** True while a multi-delete confirm/flight is running — animates Delete. */
  bulkDeleteBusy?: boolean;
};

const MENU_ITEM_CLASS =
  "flex w-full cursor-default items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text outline-none data-[highlighted]:bg-files-surface-muted";

const MENU_CONTENT_CLASS =
  "z-50 w-52 rounded-files-card border border-files-border bg-files-surface p-1 shadow-files-bubble";

const CHECKBOX_CLASS =
  "size-4 rounded border-files-border-strong text-files-cta focus:ring-files-cta transition-opacity motion-reduce:transition-none";

/**
 * Hover/selection reveal (Notion / Linear / Drive):
 * hidden at rest, column width reserved; show on hover, focus, selection, or touch.
 */
const CHECKBOX_REVEAL_CLASS =
  "opacity-0 focus-visible:opacity-100 pointer-coarse:opacity-100 group-data-[selection-active=true]/files:opacity-100";

/** Minimal, borderless document glyph — matches the calm file-list reference. */
function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const family = mimeFamily(mimeType);
  const isSpreadsheet =
    mimeType?.includes("spreadsheet") || mimeType?.includes("csv");
  const IconComponent =
    family === "images" ? FileImage : isSpreadsheet ? FileSpreadsheet : FileText;
  return (
    <IconComponent aria-hidden="true" className="size-5 shrink-0 text-files-text-muted" />
  );
}

function IngestionBadge({ status }: { status: string }) {
  if (status === "ready") return null;
  const label =
    status === "local_only"
      ? "On this device"
      : status === "failed"
        ? "Failed"
        : "Processing";
  return (
    <Badge variant={status === "failed" ? "destructive" : "secondary"}>
      {label}
    </Badge>
  );
}

function formatModified(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function OwnerCell({ owner }: { owner: OwnerDisplay }) {
  const label = owner.name ?? owner.email;
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt=""
          className="size-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-files-folder text-product-meta font-semibold text-ink">
          {initial}
        </span>
      )}
      <span className="truncate text-product-body text-files-text-muted">
        {owner.email}
      </span>
    </div>
  );
}

function RowMenu({
  file,
  folders,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
  onMoveFileToFolder,
}: {
  file: ProductFileItem;
  folders: FolderTreeItem[];
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (files: ProductFileItem[]) => void;
  onLinkToEvent: (files: ProductFileItem[]) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${file.name}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="flex size-7 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta data-[state=open]:bg-files-surface-muted data-[state=open]:text-files-text"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          onClick={(event) => event.stopPropagation()}
          className={MENU_CONTENT_CLASS}
        >
          {file.previewUrl ? (
            <DropdownMenu.Item asChild>
              <a
                href={file.previewUrl}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                className={MENU_ITEM_CLASS}
              >
                <Download aria-hidden="true" className="size-4 shrink-0" />
                Download
              </a>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item
            className={MENU_ITEM_CLASS}
            onSelect={() => onAttachToTask([file])}
          >
            <Paperclip aria-hidden="true" className="size-4 shrink-0" />
            Attach to task
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={MENU_ITEM_CLASS}
            onSelect={() => onLinkToEvent([file])}
          >
            <Link2 aria-hidden="true" className="size-4 shrink-0" />
            Link to event
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={`${MENU_ITEM_CLASS} justify-between`}>
              <span className="flex items-center gap-2">
                <FolderInput aria-hidden="true" className="size-4 shrink-0" />
                Move to folder
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={6}
                collisionPadding={12}
                avoidCollisions
                className={`${MENU_CONTENT_CLASS} max-h-56 overflow-auto`}
              >
                {folders.map((folder) => (
                  <DropdownMenu.Item
                    key={folder.id}
                    className={MENU_ITEM_CLASS}
                    style={{ paddingLeft: `${0.75 + folder.depth * 0.75}rem` }}
                    onSelect={() => onMoveFileToFolder(file.id, folder.id)}
                  >
                    <span className="truncate">{folder.name}</span>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Item
                  className={`${MENU_ITEM_CLASS} text-files-text-muted`}
                  onSelect={() => onMoveFileToFolder(file.id, null)}
                >
                  Remove from folder
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="my-1 h-px bg-files-border" />
          <DropdownMenu.Item
            className={`${MENU_ITEM_CLASS} text-brick`}
            onSelect={() => onDeleteFile(file)}
          >
            <Trash2 aria-hidden="true" className="size-4 shrink-0" />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SelectionToolbar({
  selectedFiles,
  folders,
  onClear,
  onDownload,
  onAttachToTask,
  onLinkToEvent,
  onMoveToFolder,
  onDelete,
  deleteBusy = false,
}: {
  selectedFiles: ProductFileItem[];
  folders: FolderTreeItem[];
  onClear: () => void;
  onDownload: () => void;
  onAttachToTask: () => void;
  onLinkToEvent: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onDelete?: () => void;
  deleteBusy?: boolean;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const count = selectedFiles.length;
  const downloadable = selectedFiles.some((file) => Boolean(file.previewUrl));
  const showDeleteMotion = deleteBusy && count > 1 && !prefersReducedMotion;

  return (
    <div
      role="toolbar"
      aria-label="Selected files"
      className="flex min-h-12 flex-wrap items-center gap-2 rounded-files-card border border-files-border bg-files-surface px-3 py-2"
    >
      <p className="mr-1 text-product-body font-medium text-files-text">
        {count} selected
      </p>
      <button
        type="button"
        disabled={!downloadable}
        onClick={onDownload}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-product-body text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download aria-hidden="true" className="size-4" />
        Download
      </button>
      <button
        type="button"
        onClick={onAttachToTask}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-product-body text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
      >
        <Paperclip aria-hidden="true" className="size-4" />
        Attach to task
      </button>
      <button
        type="button"
        onClick={onLinkToEvent}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-product-body text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
      >
        <Link2 aria-hidden="true" className="size-4" />
        Link to event
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-product-body text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta data-[state=open]:bg-files-surface-muted"
        >
          <FolderInput aria-hidden="true" className="size-4" />
          Move to folder
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
            avoidCollisions
            className={`${MENU_CONTENT_CLASS} max-h-56 overflow-auto`}
          >
            {folders.map((folder) => (
              <DropdownMenu.Item
                key={folder.id}
                className={MENU_ITEM_CLASS}
                style={{ paddingLeft: `${0.75 + folder.depth * 0.75}rem` }}
                onSelect={() => onMoveToFolder(folder.id)}
              >
                <span className="truncate">{folder.name}</span>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Item
              className={`${MENU_ITEM_CLASS} text-files-text-muted`}
              onSelect={() => onMoveToFolder(null)}
            >
              Remove from folder
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {onDelete ? (
        <motion.button
          type="button"
          onClick={onDelete}
          disabled={deleteBusy}
          animate={
            showDeleteMotion
              ? { opacity: [1, 0.55, 1], scale: [1, 0.98, 1] }
              : { opacity: 1, scale: 1 }
          }
          transition={
            showDeleteMotion
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.15 }
          }
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-product-body text-brick outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta disabled:cursor-not-allowed"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          {deleteBusy && count > 1 ? "Deleting…" : "Delete"}
        </motion.button>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-auto flex size-7 items-center justify-center rounded-md text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function FileRow({
  file,
  owner,
  folders,
  isSelected,
  isOpened,
  onToggleSelect,
  onOpenFile,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
  onMoveFileToFolder,
  isFocusTarget,
  onFocusRow,
  onMoveFocus,
}: {
  file: ProductFileItem;
  owner: OwnerDisplay;
  folders: FolderTreeItem[];
  isSelected: boolean;
  isOpened: boolean;
  isFocusTarget: boolean;
  onToggleSelect: (fileId: string) => void;
  onOpenFile: (
    file: ProductFileItem,
    options?: { toggleSame?: boolean },
  ) => void;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (files: ProductFileItem[]) => void;
  onLinkToEvent: (files: ProductFileItem[]) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
  onFocusRow: (fileId: string) => void;
  onMoveFocus: (delta: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fileDragId(file.id),
  });

  return (
    <tr
      data-file-row-id={file.id}
      onFocus={() => onFocusRow(file.id)}
      onClick={(event) => {
        // Ignore clicks on nested controls (checkbox, drag, row menu).
        if (
          event.target !== event.currentTarget &&
          (event.target as HTMLElement).closest(
            "button,a,input,[role='menuitem']",
          )
        ) {
          return;
        }
        onFocusRow(file.id);
        event.currentTarget.focus({ preventScroll: true });
        onOpenFile(file);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onMoveFocus(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onMoveFocus(-1);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onOpenFile(file);
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          onToggleSelect(file.id);
        }
      }}
      tabIndex={isFocusTarget ? 0 : -1}
      aria-selected={isSelected}
      data-opened={isOpened ? "true" : undefined}
      className={`group cursor-pointer border-b border-files-border/70 outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta ${
        isSelected
          ? "bg-files-surface-muted ring-1 ring-inset ring-files-border-strong"
          : isOpened
            ? "bg-files-surface-muted/70"
            : "hover:bg-files-surface-muted/60"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <td className="w-10 py-4 pl-4 pr-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(file.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${file.name}`}
          className={`${CHECKBOX_CLASS} ${CHECKBOX_REVEAL_CLASS} group-hover:opacity-100 group-focus-within:opacity-100 checked:opacity-100`}
        />
      </td>
      <td className="w-8 py-4 pl-2 pr-0">
        <button
          ref={setNodeRef}
          type="button"
          aria-label={`Drag ${file.name} to a folder`}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
          className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-files-text-muted opacity-0 outline-none transition-opacity hover:text-files-text focus-visible:opacity-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta group-hover:opacity-100"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </td>
      <td className="px-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileTypeIcon mimeType={file.mime_type} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-product-body font-medium text-files-text">
                {file.name}
              </span>
              <IngestionBadge status={file.ingestion_status} />
            </div>
            {file.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {file.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-files-border px-1.5 py-0.5 text-product-meta text-files-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <OwnerCell owner={owner} />
      </td>
      <td className="hidden px-3 py-4 text-product-body tabular-nums text-files-text-muted sm:table-cell">
        {file.size_bytes === null ? "—" : formatBytes(file.size_bytes)}
      </td>
      <td className="hidden px-3 py-4 text-product-body text-files-text-muted md:table-cell">
        {formatModified(file.created_at)}
      </td>
      <td className="w-12 px-3 py-4 text-right">
        <div className="flex justify-end">
          <RowMenu
            file={file}
            folders={folders}
            onDeleteFile={onDeleteFile}
            onAttachToTask={onAttachToTask}
            onLinkToEvent={onLinkToEvent}
            onMoveFileToFolder={onMoveFileToFolder}
          />
        </div>
      </td>
    </tr>
  );
}

export function FilesTable({
  files,
  owner,
  folders,
  openedFileId,
  previewFileId,
  selection,
  onSelectionChange,
  onOpenFile,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
  onMoveFileToFolder,
  onBulkDownload,
  onBulkMoveToFolder,
  onBulkDelete,
  bulkDeleteBusy = false,
}: FilesTableProps) {
  const orderedIds = files.map((file) => file.id);
  const selectedFiles = files.filter((file) =>
    isFileListSelected(selection, file.id),
  );
  const selectAllState = fileListSelectAllState({
    selectedIds: selection.selectedIds,
    visibleIds: orderedIds,
  });
  const hasSelection = selection.selectedIds.length > 0;
  const selectAllRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(
    () => orderedIds[0] ?? null,
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = selectAllState === "some";
  }, [selectAllState]);

  useEffect(() => {
    if (orderedIds.length === 0) {
      setFocusId(null);
      return;
    }
    if (focusId && orderedIds.includes(focusId)) return;
    setFocusId(orderedIds[0] ?? null);
  }, [focusId, orderedIds]);

  function moveFocus(delta: -1 | 1) {
    if (orderedIds.length === 0) return;
    const currentIndex = focusId ? orderedIds.indexOf(focusId) : -1;
    const fallback = delta > 0 ? 0 : orderedIds.length - 1;
    const nextIndex =
      currentIndex < 0
        ? fallback
        : Math.max(0, Math.min(orderedIds.length - 1, currentIndex + delta));
    const nextId = orderedIds[nextIndex]!;
    setFocusId(nextId);
    const row = tableRef.current?.querySelector<HTMLElement>(
      `[data-file-row-id="${nextId}"]`,
    );
    row?.focus();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[role='dialog'],[role='menu'],input,textarea")) return;

      const isSelectAll =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a";
      if (isSelectAll) {
        const root = tableRef.current;
        if (!root) return;
        if (target && !root.contains(target)) return;
        event.preventDefault();
        onSelectionChange({ type: "set", ids: orderedIds });
        return;
      }

      if (event.key !== "Escape") return;
      if (selection.selectedIds.length === 0) return;
      event.preventDefault();
      onSelectionChange({ type: "clear" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSelectionChange, orderedIds, selection.selectedIds.length]);

  return (
    <div ref={tableRef}>
      {/*
        Always reserve toolbar height so the first selection cannot shift row Y.
      */}
      <div className="mb-3 min-h-12">
        {selectedFiles.length > 0 ? (
          <SelectionToolbar
            selectedFiles={selectedFiles}
            folders={folders}
            onClear={() => onSelectionChange({ type: "clear" })}
            onDownload={() => onBulkDownload(selectedFiles)}
            onAttachToTask={() => onAttachToTask(selectedFiles)}
            onLinkToEvent={() => onLinkToEvent(selectedFiles)}
            onMoveToFolder={(folderId) =>
              onBulkMoveToFolder(selectedFiles, folderId)
            }
            onDelete={
              onBulkDelete ? () => onBulkDelete(selectedFiles) : undefined
            }
            deleteBusy={bulkDeleteBusy}
          />
        ) : (
          <div
            className="min-h-12 rounded-files-card border border-transparent px-3 py-2"
            aria-hidden="true"
          />
        )}
      </div>
      <table
        className="group/files w-full border-collapse"
        aria-label="Files"
        data-selection-active={hasSelection ? "true" : undefined}
      >
        <thead className="group/thead">
          <tr className="border-b border-files-border text-left">
            <th scope="col" className="w-10 py-3 pl-4 pr-0">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={selectAllState === "all"}
                onChange={() =>
                  onSelectionChange(
                    fileListSelectAllIntent({
                      selectedIds: selection.selectedIds,
                      visibleIds: orderedIds,
                    }),
                  )
                }
                aria-label="Select all visible files"
                aria-checked={
                  selectAllState === "some" ? "mixed" : selectAllState === "all"
                }
                className={`${CHECKBOX_CLASS} ${CHECKBOX_REVEAL_CLASS} group-hover/files:opacity-100 group-hover/thead:opacity-100 checked:opacity-100 indeterminate:opacity-100`}
              />
            </th>
            <th scope="col" className="w-8 py-3 pl-2 pr-0" aria-label="Drag" />
            <th
              scope="col"
              className="px-3 py-3 text-product-column font-medium text-files-text-muted"
            >
              Name
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted sm:table-cell"
            >
              Added by
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted sm:table-cell"
            >
              File size
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3 text-product-column font-medium text-files-text-muted md:table-cell"
            >
              Modified
            </th>
            <th
              scope="col"
              className="w-12 px-3 py-3 text-right text-product-column font-medium text-files-text-muted"
              aria-label="Actions"
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              owner={owner}
              folders={folders}
              isSelected={isFileListSelected(selection, file.id)}
              isOpened={
                file.id === openedFileId || file.id === previewFileId
              }
              isFocusTarget={file.id === focusId}
              onToggleSelect={(fileId) =>
                onSelectionChange({ type: "toggle", id: fileId })
              }
              onOpenFile={onOpenFile}
              onDeleteFile={onDeleteFile}
              onAttachToTask={onAttachToTask}
              onLinkToEvent={onLinkToEvent}
              onMoveFileToFolder={onMoveFileToFolder}
              onFocusRow={setFocusId}
              onMoveFocus={moveFocus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
