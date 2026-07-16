"use client";

import Link from "next/link";
import { deleteFile } from "@/app/(workspace)/files/actions";
import { HoverDeleteAction } from "@/components/ui/hover-delete-action";
import { Icon } from "@/components/ui/planevo-icon";
import type { FileSourceItem } from "@/lib/queries/files";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Planevo page";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileRow({ file }: { file: FileSourceItem }) {
  const main = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary">
        <Icon name={file.pageId ? "document" : "files"} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{file.name}</span>
        <span className="mt-1 block text-small text-text-muted">
          {formatBytes(file.sizeBytes)} ·{" "}
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date(file.createdAt))}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-slate-tint px-2 py-1 text-label capitalize text-ink">
        {file.status}
      </span>
    </>
  );

  const linkClass =
    "flex min-w-0 flex-1 items-center gap-4 outline-none hover:bg-paper focus-visible:bg-paper";

  return (
    <HoverDeleteAction
      className="border-b border-border px-4 py-4 last:border-b-0"
      label={`Delete ${file.name}`}
      title={`Delete “${file.name}”?`}
      description={
        file.pageId
          ? "This permanently removes the file entry and its linked Planevo page. This can't be undone."
          : "This permanently removes the file from storage and your workspace. This can't be undone."
      }
      confirmLabel="Delete file"
      onConfirm={() => deleteFile(file.id)}
    >
      {file.previewUrl && file.pageId ? (
        <Link href={file.previewUrl} className={linkClass}>
          {main}
        </Link>
      ) : file.previewUrl ? (
        <a href={file.previewUrl} target="_blank" rel="noreferrer" className={linkClass}>
          {main}
        </a>
      ) : (
        <div className={linkClass}>{main}</div>
      )}
    </HoverDeleteAction>
  );
}
