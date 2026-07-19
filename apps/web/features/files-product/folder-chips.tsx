"use client";

import { Folder } from "lucide-react";

type FolderChipsProps = {
  folders: string[];
  selectedFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
};

/** Folder filter chips from distinct metadata folders. Click again to clear. */
export function FolderChips({
  folders,
  selectedFolder,
  onSelectFolder,
}: FolderChipsProps) {
  if (folders.length === 0) return null;

  return (
    <div role="group" aria-label="Folders" className="flex flex-wrap gap-2">
      {folders.map((folder) => {
        const isSelected = folder === selectedFolder;
        return (
          <button
            key={folder}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectFolder(isSelected ? null : folder)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-product-body outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
              isSelected
                ? "border-border-strong bg-surface-raised font-medium text-ink"
                : "border-border bg-paper text-text-secondary hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <Folder aria-hidden="true" className="size-4" />
            {folder}
          </button>
        );
      })}
    </div>
  );
}
