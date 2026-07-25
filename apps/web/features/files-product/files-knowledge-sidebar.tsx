"use client";

import { useState } from "react";
import { Folder, FolderOpen, PanelLeft, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilesFolderTree, FolderCreateRow } from "./files-folder-tree";
import { FilesTagList } from "./files-tag-list";
import type { FolderTreeItem, TagCount } from "./kb-contracts";

export type FilesKnowledgeSidebarProps = {
  activeTab: "folders" | "tags";
  onTabChange: (tab: "folders" | "tags") => void;
  search: string;
  onSearchChange: (value: string) => void;
  onCollapse: () => void;
  folders: FolderTreeItem[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<boolean>;
  onRenameFolder: (folderId: string, name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string) => void;
  tags: TagCount[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
};

const TABS = [
  { id: "folders", label: "Folders" },
  { id: "tags", label: "Tags" },
] as const;

/**
 * Left secondary sidebar for the Files Library: title/create/collapse
 * header, search, a Folders/Tags segmented control, and the matching tab body
 * (folder tree or tag list), with an "All files" root row above the tree.
 */
export function FilesKnowledgeSidebar({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  onCollapse,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  tags,
  selectedTag,
  onSelectTag,
}: FilesKnowledgeSidebarProps) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);

  async function handleCreateRoot(name: string) {
    const ok = await onCreateFolder(name, null);
    if (ok) setIsCreatingRoot(false);
    return ok;
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4 text-files-text">
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <h2 className="text-h3 font-semibold text-files-text">Library</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Create root folder"
            onClick={() => setIsCreatingRoot(true)}
            className="flex size-7 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onCollapse}
            className="flex size-7 items-center justify-center rounded-lg text-files-text-muted outline-none hover:bg-files-surface-muted hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <label className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-files-text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search…"
          aria-label="Search library"
          className="w-full rounded-lg border border-files-border bg-files-surface-muted py-2.5 pl-9 pr-3 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong focus-visible:outline-none"
        />
      </label>

      <div
        role="tablist"
        aria-label="Library view"
        className="flex rounded-xl border border-files-border bg-files-surface-muted p-1"
      >
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                isSelected
                  ? "bg-files-surface text-files-text shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                  : "text-files-text-muted hover:text-files-text",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <nav aria-label="Folders and tags" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {activeTab === "folders" ? (
          <>
            <ul className="flex flex-col gap-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectFolder(null)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-product-body outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                    selectedFolderId === null
                      ? "bg-files-surface-muted font-medium text-files-text"
                      : "text-files-text-muted hover:bg-files-surface-muted hover:text-files-text",
                  )}
                >
                  {selectedFolderId === null ? (
                    <FolderOpen
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        selectedFolderId === null
                          ? "text-files-text"
                          : "text-files-text-muted",
                      )}
                    />
                  ) : (
                    <Folder
                      aria-hidden="true"
                      className="size-4 shrink-0 text-files-text-muted"
                    />
                  )}
                  All files
                </button>
              </li>
              {isCreatingRoot && (
                <FolderCreateRow
                  depth={0}
                  onSubmit={handleCreateRoot}
                  onCancel={() => setIsCreatingRoot(false)}
                />
              )}
            </ul>

            <FilesFolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          </>
        ) : (
          <FilesTagList tags={tags} selectedTag={selectedTag} onSelectTag={onSelectTag} />
        )}
      </nav>
    </div>
  );
}
