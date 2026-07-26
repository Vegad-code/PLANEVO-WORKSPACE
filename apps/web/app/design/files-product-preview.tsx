"use client";

import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import { FilePreviewPanel } from "@/features/files-product/file-preview-panel";
import { FilesBreadcrumbHeader } from "@/features/files-product/files-breadcrumb-header";
import { FilesFolderCards } from "@/features/files-product/files-folder-cards";
import { FilesKnowledgeSidebar } from "@/features/files-product/files-knowledge-sidebar";
import { FilesTable, type ProductFileItem } from "@/features/files-product/files-table";
import { StorageMeter } from "@/features/files-product/storage-meter";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import type {
  FolderTreeItem,
  OwnerDisplay,
  TagCount,
} from "@/features/files-product/kb-contracts";

function noop() {
  // Design previews render interactions inert.
}

async function asyncTrue(): Promise<boolean> {
  return true;
}

const DESIGN_FOLDERS: FolderTreeItem[] = [
  { id: "general", name: "General Knowledge", parentId: null, depth: 0, position: 1, fileCount: 10 },
  { id: "onboarding", name: "Onboarding", parentId: "general", depth: 1, position: 1, fileCount: 3 },
  { id: "sub1", name: "Subfolder 1", parentId: "onboarding", depth: 2, position: 1, fileCount: 5 },
  { id: "sub2", name: "Subfolder 2", parentId: "onboarding", depth: 2, position: 2, fileCount: 10 },
  { id: "integrations", name: "Integrations", parentId: "general", depth: 1, position: 2, fileCount: 5 },
  { id: "documents", name: "Documents", parentId: "general", depth: 1, position: 3, fileCount: 10 },
  { id: "onboarding-design", name: "Onboarding Design", parentId: null, depth: 0, position: 2, fileCount: 4 },
  { id: "team-interviews", name: "Team Interviews", parentId: null, depth: 0, position: 3, fileCount: 6 },
];

const DESIGN_OWNER: OwnerDisplay = {
  email: "kevin@mail.com",
  name: "Kevin Rivera",
  avatarUrl: null,
};

const DESIGN_TAGS: TagCount[] = [
  { tag: "finance", count: 4 },
  { tag: "brand", count: 3 },
  { tag: "design", count: 2 },
];

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
    folder_id: "general",
    tags: [],
    previewUrl: null,
    ...overrides,
  };
}

const DESIGN_FILES: ProductFileItem[] = [
  previewFile({
    id: "file-guide",
    name: "Onboarding-Guide.pdf",
    tags: ["onboarding"],
    size_bytes: 1_100_000_000,
  }),
  previewFile({
    id: "file-roadmap",
    name: "Product-Roadmap.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: 900_000_000,
  }),
  previewFile({
    id: "file-logo",
    name: "logo-final.png",
    mime_type: "image/png",
    size_bytes: 1_800_000_000,
    tags: ["brand", "design"],
  }),
  previewFile({
    id: "file-financials",
    name: "FY_2026-27 Financials.xlsx",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 400_000_000,
    tags: ["finance"],
  }),
];

// Files inside the child folders so their cards render sheets + type glyphs.
const CARD_FILES: ProductFileItem[] = [
  ...DESIGN_FILES,
  previewFile({ id: "onb-1", name: "welcome.pdf", folder_id: "onboarding" }),
  previewFile({ id: "onb-2", name: "handbook.docx", folder_id: "onboarding", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
  previewFile({ id: "onb-3", name: "office.png", folder_id: "onboarding", mime_type: "image/png" }),
  previewFile({ id: "int-1", name: "api.pdf", folder_id: "integrations" }),
  previewFile({ id: "int-2", name: "diagram.png", folder_id: "integrations", mime_type: "image/png" }),
  previewFile({ id: "doc-1", name: "spec.pdf", folder_id: "documents" }),
];

export function FilesProductPreview() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>("general");
  const [activeTab, setActiveTab] = useState<"folders" | "tags">("folders");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  return (
    <div data-product="files" className="files-product-ui">
      <div className="overflow-hidden rounded-card border border-border">
        <DndContext id="files-design-preview">
          <div className="flex h-[38rem] w-full overflow-hidden">
          <aside className="relative hidden w-72 shrink-0 flex-col border-r border-files-border bg-files-surface lg:flex">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FilesKnowledgeSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                search={search}
                onSearchChange={setSearch}
                onCollapse={noop}
                folders={DESIGN_FOLDERS}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={asyncTrue}
                onRenameFolder={asyncTrue}
                onDeleteFolder={noop}
                tags={DESIGN_TAGS}
                selectedTag={selectedTag}
                onSelectTag={setSelectedTag}
              />
            </div>
            <div className="relative w-full shrink-0 bg-files-surface shadow-[inset_0_1px_0_0_var(--color-files-border-strong)]">
              <div className="p-3">
                <StorageMeter
                  usedBytes={4_200_000_000}
                  capBytes={5 * 1024 * 1024 * 1024}
                  files={DESIGN_FILES}
                />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-files-bg">
              <div className="sticky top-0 z-10 bg-files-bg/95 px-6 pt-4 pb-3 backdrop-blur-sm lg:px-8">
                <FilesBreadcrumbHeader
                  folders={DESIGN_FOLDERS}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                />
              </div>
              <div className="px-6 pb-12 pt-2 lg:px-8">
                <FilesFolderCards
                  folders={DESIGN_FOLDERS}
                  files={CARD_FILES}
                  parentId={selectedFolderId}
                  onOpenFolder={setSelectedFolderId}
                />
                <section className="mt-8" aria-label="Files">
                  <h2 className="text-product-body font-medium text-files-text-muted">Files</h2>
                  <div className="mt-3">
                    <FilesTable
                      files={DESIGN_FILES}
                      owner={DESIGN_OWNER}
                      folders={DESIGN_FOLDERS}
                      selectedFileId="file-logo"
                      onSelectFile={noop}
                      onDeleteFile={noop}
                      onAttachToTask={noop}
                      onLinkToEvent={noop}
                      onMoveFileToFolder={noop}
                    />
                  </div>
                </section>
              </div>
            </div>

            <FilePreviewPanel
              file={previewFile({
                id: "file-logo",
                name: "logo-final.png",
                mime_type: "image/png",
                size_bytes: 84_000,
                tags: ["brand", "design"],
              })}
              onClose={noop}
              onUpdateTags={noop}
              onRenameFile={asyncTrue}
            />
          </div>
          </div>
        </DndContext>
      </div>
      <section className="mt-6" aria-label="Document editor states">
        <h3 className="text-h3 font-semibold text-files-text">
          Document editor states
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-files-card border border-files-border bg-files-surface p-4">
            <p className="text-product-body font-medium text-files-text">
              Canonical save
            </p>
            <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
              <span className="text-product-meta text-files-text-muted">
                Markdown · live preview
              </span>
              <SaveIndicator
                state="saving"
                savingLabel="Saving to Planevo…"
              />
            </div>
          </div>
          <div className="rounded-files-card border border-meadow bg-meadow-tint p-4">
            <p className="text-product-body font-medium text-meadow">
              Recovery available
            </p>
            <p className="mt-2 text-product-meta text-meadow">
              Recovered unsaved changes from this browser.
            </p>
          </div>
          <div className="rounded-files-card border border-brick bg-brick-tint p-4">
            <p className="text-product-body font-medium text-brick">
              Persistent save failure
            </p>
            <p className="mt-2 text-product-meta text-brick">
              Saved to Planevo. The computer file needs permission.
            </p>
            <button
              type="button"
              className="mt-3 text-product-meta font-medium text-brick underline underline-offset-2"
            >
              Reconnect file
            </button>
          </div>
          <div className="rounded-files-card border border-brick bg-brick-tint p-4">
            <p className="text-product-body font-medium text-brick">
              Version conflict
            </p>
            <p className="mt-2 text-product-meta text-brick">
              This document changed somewhere else.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="text-product-meta font-medium text-brick underline underline-offset-2"
              >
                Use Planevo version
              </button>
              <button
                type="button"
                className="text-product-meta font-medium text-brick underline underline-offset-2"
              >
                Save my copy
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
