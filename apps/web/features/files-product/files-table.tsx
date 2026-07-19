"use client";

import { useState } from "react";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  MoreHorizontal,
  Paperclip,
  Trash2,
} from "lucide-react";
import type { FileSourceWithMeta } from "@planevo/core/queries/product-files";
import { mimeFamily } from "@planevo/core/types/files";
import { formatBytes } from "./storage-meter";

export type ProductFileItem = FileSourceWithMeta & {
  previewUrl: string | null;
};

type FilesTableProps = {
  files: ProductFileItem[];
  selectedFileId: string | null;
  onSelectFile: (file: ProductFileItem) => void;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (file: ProductFileItem) => void;
  onLinkToEvent: (file: ProductFileItem) => void;
};

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const family = mimeFamily(mimeType);
  const isSpreadsheet =
    mimeType?.includes("spreadsheet") || mimeType?.includes("csv");
  const IconComponent =
    family === "images"
      ? FileImage
      : isSpreadsheet
        ? FileSpreadsheet
        : FileText;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary">
      <IconComponent aria-hidden="true" className="size-4" />
    </span>
  );
}

function IngestionBadge({ status }: { status: string }) {
  if (status === "ready") return null;
  const label = status === "failed" ? "Failed" : "Processing";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-product-meta ${
        status === "failed"
          ? "bg-brick-tint text-ink"
          : "bg-slate-tint text-ink"
      }`}
    >
      {label}
    </span>
  );
}

function formatModified(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RowMenu({
  file,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
}: {
  file: ProductFileItem;
  onDeleteFile: (file: ProductFileItem) => void;
  onAttachToTask: (file: ProductFileItem) => void;
  onLinkToEvent: (file: ProductFileItem) => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(action: () => void) {
    setOpen(false);
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
        }}
        className="flex size-7 items-center justify-center rounded-lg text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
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
              setOpen(false);
            }}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border bg-paper p-1"
            onClick={(event) => event.stopPropagation()}
          >
            {file.previewUrl ? (
              <a
                role="menuitem"
                href={file.previewUrl}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-product-body text-ink hover:bg-surface-raised"
              >
                <Download aria-hidden="true" className="size-4" />
                Download
              </a>
            ) : null}
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onAttachToTask(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-ink hover:bg-surface-raised"
            >
              <Paperclip aria-hidden="true" className="size-4" />
              Attach to task
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onLinkToEvent(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-ink hover:bg-surface-raised"
            >
              <Link2 aria-hidden="true" className="size-4" />
              Link to event
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => choose(() => onDeleteFile(file))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-product-body text-brick hover:bg-surface-raised"
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

export function FilesTable({
  files,
  selectedFileId,
  onSelectFile,
  onDeleteFile,
  onAttachToTask,
  onLinkToEvent,
}: FilesTableProps) {
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());

  function toggleChecked(fileId: string) {
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border text-left">
          <th scope="col" className="w-10 px-3 py-2" aria-label="Select" />
          <th scope="col" className="px-3 py-2 text-product-column text-text-muted">
            Name
          </th>
          <th scope="col" className="hidden px-3 py-2 text-product-column text-text-muted sm:table-cell">
            Shared by
          </th>
          <th scope="col" className="hidden px-3 py-2 text-product-column text-text-muted sm:table-cell">
            Size
          </th>
          <th scope="col" className="hidden px-3 py-2 text-product-column text-text-muted md:table-cell">
            Modified
          </th>
          <th scope="col" className="w-12 px-3 py-2" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {files.map((file) => {
          const isSelected = file.id === selectedFileId;
          return (
            <tr
              key={file.id}
              onClick={() => onSelectFile(file)}
              className={`cursor-pointer border-b border-border/70 ${
                isSelected ? "bg-surface-raised" : "hover:bg-surface-raised/60"
              }`}
            >
              <td className="px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${file.name}`}
                  checked={checkedIds.has(file.id)}
                  onChange={() => toggleChecked(file.id)}
                  onClick={(event) => event.stopPropagation()}
                  className="size-3.5 cursor-pointer accent-ink"
                />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileTypeIcon mimeType={file.mime_type} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-product-title text-ink">
                        {file.name}
                      </span>
                      <IngestionBadge status={file.ingestion_status} />
                    </div>
                    {file.tags.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {file.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border px-1.5 py-0 text-product-meta text-text-secondary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="hidden px-3 py-2.5 sm:table-cell">
                <span className="flex items-center gap-2 text-product-body text-text-secondary">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full border border-border bg-surface-raised text-product-meta"
                  >
                    Y
                  </span>
                  You
                </span>
              </td>
              <td className="hidden px-3 py-2.5 text-product-body tabular-nums text-text-secondary sm:table-cell">
                {file.size_bytes === null ? "—" : formatBytes(file.size_bytes)}
              </td>
              <td className="hidden px-3 py-2.5 text-product-body text-text-secondary md:table-cell">
                {formatModified(file.created_at)}
              </td>
              <td className="px-3 py-2.5">
                <RowMenu
                  file={file}
                  onDeleteFile={onDeleteFile}
                  onAttachToTask={onAttachToTask}
                  onLinkToEvent={onLinkToEvent}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
