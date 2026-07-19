"use client";

import { Search } from "lucide-react";
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

type FilesFilterTabsProps = {
  activeTab: FileFilterTab;
  onTabChange: (tab: FileFilterTab) => void;
  search: string;
  onSearchChange: (search: string) => void;
};

export function FilesFilterTabs({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
}: FilesFilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="File type filter"
        className="flex rounded-lg border border-border bg-surface-raised p-0.5"
      >
        {FILE_FILTER_TABS.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onTabChange(tab)}
              className={`rounded-md px-3 py-1.5 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                isSelected
                  ? "border border-border bg-paper text-ink"
                  : "border border-transparent text-text-secondary hover:text-ink"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <label className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-4 text-text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          className="w-64 rounded-lg border border-border bg-surface-raised py-2 pl-9 pr-3 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
        />
      </label>
    </div>
  );
}
