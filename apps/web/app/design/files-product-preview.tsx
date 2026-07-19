"use client";

import { useState } from "react";
import type { FileFilterTab } from "@planevo/core/types/files";
import { FilesActionRow } from "@/features/files-product/files-action-row";
import { FilesCabinetHeader } from "@/features/files-product/files-cabinet-header";
import { FilesFilterTabs } from "@/features/files-product/files-filter-tabs";
import { FilesTable, type ProductFileItem } from "@/features/files-product/files-table";
import { FilesUploadDropzone } from "@/features/files-product/files-upload-dropzone";
import { FolderChips } from "@/features/files-product/folder-chips";
import { StorageMeter } from "@/features/files-product/storage-meter";

function noop() {
  // Design previews render interactions inert.
}

function previewFile(
  overrides: Partial<ProductFileItem> & Pick<ProductFileItem, "id" | "name">,
): ProductFileItem {
  return {
    workspace_id: "design-workspace",
    page_id: null,
    created_by: "design-owner",
    user_id: "design-owner",
    operation_key: null,
    reservation_expires_at: null,
    storage_path: `design-workspace/${overrides.id}`,
    mime_type: "application/pdf",
    size_bytes: 1_200_000,
    ingestion_status: "ready",
    metadata_json: {},
    created_at: "2026-07-16T10:00:00.000Z",
    updated_at: "2026-07-16T10:00:00.000Z",
    folder: null,
    tags: [],
    previewUrl: null,
    ...overrides,
  };
}

const DESIGN_FILES: ProductFileItem[] = [
  previewFile({ id: "file-report", name: "Q4_2026 Reporting.pdf", size_bytes: 1_200_000, folder: "Reports", tags: ["finance"] }),
  previewFile({ id: "file-requirements", name: "Dashboard tech requirements.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 220_000 }),
  previewFile({ id: "file-logo", name: "logo-final.png", mime_type: "image/png", size_bytes: 84_000, tags: ["brand", "design"] }),
  previewFile({ id: "file-financials", name: "FY_2026-27 Financials.xlsx", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 628_000 }),
  previewFile({ id: "file-processing", name: "kickoff-recording-notes.pdf", ingestion_status: "pending" }),
  previewFile({ id: "file-failed", name: "broken-scan.pdf", ingestion_status: "failed" }),
];

function FilesTableDemo() {
  const [activeTab, setActiveTab] = useState<FileFilterTab>("all");
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <FilesFilterTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        search={search}
        onSearchChange={setSearch}
      />
      <FilesUploadDropzone onUploadFiles={noop}>
        <FilesTable
          files={DESIGN_FILES}
          selectedFileId="file-logo"
          onSelectFile={noop}
          onDeleteFile={noop}
          onAttachToTask={noop}
          onLinkToEvent={noop}
        />
      </FilesUploadDropzone>
      <StorageMeter usedBytes={9_200_000_000} capBytes={10_737_418_240} />
    </div>
  );
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
          Filter tabs, table row states (selected, tagged, processing, failed),
          drop target, storage meter
        </figcaption>
        <div className="rounded-card border border-border bg-paper p-6">
          <FilesTableDemo />
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
