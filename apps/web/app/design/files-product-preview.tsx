"use client";

import { FilesActionRow } from "@/features/files-product/files-action-row";
import { FilesCabinetHeader } from "@/features/files-product/files-cabinet-header";
import { FolderChips } from "@/features/files-product/folder-chips";

function noop() {
  // Design previews render interactions inert.
}

export function FilesProductPreview() {
  return (
    <div className="flex flex-col gap-8">
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Cabinet header + action row (Upload is the sole marigold)
        </figcaption>
        <div className="flex flex-col gap-5 rounded-card border border-border bg-paper p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <FilesCabinetHeader firstName="Anthony" scope="all" />
            <FilesActionRow onUploadFiles={noop} />
          </div>
          <FolderChips
            folders={["UI UX Design", "Legal Docs", "Reports", "Meetings"]}
            selectedFolder="Reports"
            onSelectFolder={noop}
          />
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Header without a first name; uploading state; no folders
        </figcaption>
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-paper p-6">
          <FilesCabinetHeader firstName={null} scope="workspace" />
          <FilesActionRow onUploadFiles={noop} isUploading />
        </div>
      </figure>
    </div>
  );
}
