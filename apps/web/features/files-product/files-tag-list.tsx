"use client";

import { cn } from "@/lib/utils";
import type { TagCount } from "./kb-contracts";

export type FilesTagListProps = {
  tags: TagCount[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
};

/** Tags tab of the library sidebar: a flat list of tag chips with counts. */
export function FilesTagList({ tags, selectedTag, onSelectTag }: FilesTagListProps) {
  if (tags.length === 0) {
    return (
      <p className="px-2 py-1.5 text-product-meta text-files-text-muted">
        No tags yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {tags.map(({ tag, count }) => {
        const isSelected = selectedTag === tag;
        return (
          <li key={tag}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectTag(isSelected ? null : tag)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-files-card px-2 py-1.5 text-left text-product-body outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta",
                isSelected
                  ? "bg-files-surface-muted text-files-text"
                  : "text-files-text-muted hover:bg-files-surface-muted hover:text-files-text",
              )}
            >
              <span className="min-w-0 truncate">#{tag}</span>
              <span className="shrink-0 rounded-full bg-files-surface px-1.5 py-0.5 text-[11px] font-medium text-files-text-muted">
                {count}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
