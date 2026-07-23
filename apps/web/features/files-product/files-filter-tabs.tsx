"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  FILE_FILTER_TABS,
  type FileFilterTab,
} from "@planevo/core/types/files";

const TAB_LABELS: Record<FileFilterTab, string> = {
  all: "View all",
  documents: "Documents",
  pdfs: "PDFs",
  images: "Images",
};

export type FilesSortKey = "modified" | "name" | "size";

type FilesFilterTabsProps = {
  activeTab: FileFilterTab;
  onTabChange: (tab: FileFilterTab) => void;
  search: string;
  onSearchChange: (search: string) => void;
  starredOnly: boolean;
  onStarredOnlyChange: (starredOnly: boolean) => void;
  sortKey: FilesSortKey;
  onSortKeyChange: (sortKey: FilesSortKey) => void;
  scopeFilter?: React.ReactNode;
};

export function FilesFilterTabs({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  starredOnly,
  onStarredOnlyChange,
  sortKey,
  onSortKeyChange,
  scopeFilter,
}: FilesFilterTabsProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div
        role="group"
        aria-label="File list filter"
        className="flex gap-6"
      >
        {FILE_FILTER_TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onTabChange(tab)}
              className={`relative pb-3 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta motion-reduce:transition-none ${
                isSelected
                  ? "text-files-text"
                  : "text-files-text-muted hover:text-files-text"
              }`}
            >
              {TAB_LABELS[tab]}
              {isSelected ? (
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-files-cta" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {scopeFilter}
        <label className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-4 text-files-text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search file..."
            aria-label="Search files"
            className="w-52 rounded-files-card border border-files-border bg-files-surface py-2 pl-9 pr-3 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong sm:w-64"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            aria-expanded={filterOpen}
            aria-controls="files-advanced-filter"
            onClick={() => setFilterOpen((wasOpen) => !wasOpen)}
            className="flex items-center gap-2 rounded-files-card border border-files-border bg-files-surface px-4 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface-muted focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
          >
            <SlidersHorizontal className="size-4" />
            Filter
          </button>
          {filterOpen ? (
            <>
              <button
                type="button"
                aria-label="Close filter menu"
                tabIndex={-1}
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setFilterOpen(false)}
              />
              <div
                id="files-advanced-filter"
                className="absolute right-0 z-20 mt-2 w-56 rounded-files-card border border-files-border bg-files-surface p-3 shadow-lg"
              >
                <label className="flex items-center gap-2 text-product-body text-files-text">
                  <input
                    type="checkbox"
                    checked={starredOnly}
                    onChange={(event) => onStarredOnlyChange(event.target.checked)}
                    className="size-4 rounded border-files-border-strong text-files-cta focus:ring-files-cta"
                  />
                  Starred only
                </label>
                <label className="mt-3 block text-product-meta text-files-text-muted">
                  Sort by
                  <select
                    value={sortKey}
                    onChange={(event) =>
                      onSortKeyChange(event.target.value as FilesSortKey)
                    }
                    className="mt-1 w-full rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body text-files-text outline-none focus-visible:border-files-border-strong"
                  >
                    <option value="modified">Modified</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
