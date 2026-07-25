"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderTreeItem } from "./kb-contracts";

export type FilesBreadcrumbHeaderProps = {
  folders: FolderTreeItem[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
};

type Crumb = { id: string | null; name: string };

const ALL_FILES: Crumb = { id: null, name: "All files" };

/** Root-to-current chain for `folderId`, defensively guarding against cycles. */
function folderChain(folders: FolderTreeItem[], folderId: string | null): FolderTreeItem[] {
  if (folderId === null) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder] as const));
  const chain: FolderTreeItem[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId) ?? null;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
  }
  return chain;
}

/** Breadcrumb bar for the Library: current path, last segment is a switch-folder dropdown. */
export function FilesBreadcrumbHeader({
  folders,
  selectedFolderId,
  onSelectFolder,
}: FilesBreadcrumbHeaderProps) {
  const [open, setOpen] = useState(false);

  const chain = folderChain(folders, selectedFolderId);
  const crumbs: Crumb[] = [ALL_FILES, ...chain.map((folder) => ({ id: folder.id, name: folder.name }))];
  const ancestors = crumbs.slice(0, -1);
  const current = crumbs[crumbs.length - 1]!;

  const currentFolder = chain[chain.length - 1] ?? null;
  const siblingParentId = currentFolder ? currentFolder.parentId : null;
  const siblings = folders
    .filter((folder) => folder.parentId === siblingParentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const menuOptions: Crumb[] = [ALL_FILES, ...siblings.map((folder) => ({ id: folder.id, name: folder.name }))];

  function choose(folderId: string | null) {
    setOpen(false);
    onSelectFolder(folderId);
  }

  return (
    <div className="flex items-center gap-1.5">
      {ancestors.map((crumb) => (
        <span key={crumb.id ?? "root"} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectFolder(crumb.id)}
            className="rounded px-1 py-0.5 text-product-body text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
          >
            {crumb.name}
          </button>
          <ChevronDown aria-hidden="true" className="size-3.5 -rotate-90 text-files-text-muted" />
        </span>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="files-breadcrumb-menu"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-h2 font-medium text-files-text outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
        >
          {current.name}
          <ChevronDown aria-hidden="true" className="size-4 text-files-text-muted" />
        </button>
        {open ? (
          <>
            <button
              type="button"
              aria-label="Close folder menu"
              tabIndex={-1}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              id="files-breadcrumb-menu"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setOpen(false);
              }}
              className="absolute left-0 z-20 mt-2 w-56 rounded-files-card border border-files-border bg-files-surface p-1 shadow-lg"
            >
              {menuOptions.map((option) => {
                const isSelected = option.id === current.id;
                return (
                  <button
                    key={option.id ?? "root"}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => choose(option.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-product-body text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                    )}
                  >
                    <span className="truncate">{option.name}</span>
                    {isSelected ? (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-files-text-muted" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
