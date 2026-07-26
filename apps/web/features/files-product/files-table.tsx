"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { FileSourceWithMeta } from "@planevo/core/queries/product-files";
import { mimeFamily } from "@planevo/core/types/files";
import { Badge } from "@/components/ui/badge";
import { fileDragId, type FolderTreeItem, type OwnerDisplay } from "./kb-contracts";
import { formatBytes } from "./storage-meter";

export type ProductFileItem = FileSourceWithMeta & {
  previewUrl: string | null;
};

type FilesTableProps = {
  files: ProductFileItem[];
  owner: OwnerDisplay;
  folders: FolderTreeItem[];
  selectedFileId: string | null;
  onSelectFile: (file: ProductFileItem) => void;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (file: ProductFileItem) => void;
  onLinkToEvent: (file: ProductFileItem) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
};

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
  const label = status === "failed" ? "Failed" : "Processing";
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
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#c9a227] text-[11px] font-semibold text-black">
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
  onAttachToTask: (file: ProductFileItem) => void;
  onLinkToEvent: (file: ProductFileItem) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  function close() {
    setOpen(false);
    setMoveOpen(false);
  }

  function choose(action: () => void) {
    close();
    action();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Actions for ${file.name}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((wasOpen) => !wasOpen);
          setMoveOpen(false);
        }}
        className="flex size-7 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close file menu"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-52 rounded-files-card border border-files-border bg-files-surface p-1 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            {file.previewUrl ? (
              <a
                role="menuitem"
                href={file.previewUrl}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                onClick={() => close()}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-product-body text-files-text hover:bg-files-surface-muted"
              >
                <Download aria-hidden="true" className="size-4" />
                Download
              </a>
            ) : null}
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onAttachToTask(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text hover:bg-files-surface-muted"
            >
              <Paperclip aria-hidden="true" className="size-4" />
              Attach to task
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onLinkToEvent(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text hover:bg-files-surface-muted"
            >
              <Link2 aria-hidden="true" className="size-4" />
              Link to event
            </button>
            <button
              role="menuitem"
              type="button"
              aria-expanded={moveOpen}
              onClick={() => setMoveOpen((wasOpen) => !wasOpen)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text hover:bg-files-surface-muted"
            >
              <FolderInput aria-hidden="true" className="size-4" />
              Move to folder
            </button>
            {moveOpen ? (
              <div
                role="group"
                aria-label="Move to folder"
                className="mt-1 max-h-56 overflow-auto border-t border-files-border pt-1"
              >
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    role="menuitem"
                    type="button"
                    onClick={() => choose(() => onMoveFileToFolder(file.id, folder.id))}
                    style={{ paddingLeft: `${0.75 + folder.depth * 0.75}rem` }}
                    className="flex w-full items-center rounded-md py-1.5 pr-3 text-left text-product-body text-files-text hover:bg-files-surface-muted"
                  >
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => choose(() => onMoveFileToFolder(file.id, null))}
                  className="flex w-full items-center rounded-md px-3 py-1.5 text-left text-product-body text-files-text-muted hover:bg-files-surface-muted"
                >
                  Remove from folder
                </button>
              </div>
            ) : null}
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onDeleteFile(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-brick hover:bg-files-surface-muted"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FileRow({
  file,
  owner,
  folders,
  isSelected,
  onSelectFile,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
  onMoveFileToFolder,
}: {
  file: ProductFileItem;
  owner: OwnerDisplay;
  folders: FolderTreeItem[];
  isSelected: boolean;
  onSelectFile: (file: ProductFileItem) => void;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (file: ProductFileItem) => void;
  onLinkToEvent: (file: ProductFileItem) => void;
  onMoveFileToFolder: (fileId: string, folderId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fileDragId(file.id),
  });

  return (
    <tr
      onClick={() => onSelectFile(file)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onSelectFile(file);
      }}
      tabIndex={0}
      aria-selected={isSelected}
      className={`group cursor-pointer border-b border-files-border/70 outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta ${
        isSelected ? "bg-files-surface-muted" : "hover:bg-files-surface-muted/60"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <td className="w-8 py-4 pl-4 pr-0">
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
  selectedFileId,
  onSelectFile,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
  onMoveFileToFolder,
}: FilesTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-files-border text-left">
          <th scope="col" className="w-8 py-3 pl-4 pr-0" aria-label="Drag" />
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
            isSelected={file.id === selectedFileId}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onAttachToTask={onAttachToTask}
            onLinkToEvent={onLinkToEvent}
            onMoveFileToFolder={onMoveFileToFolder}
          />
        ))}
      </tbody>
    </table>
  );
}
