"use client";

import { useState } from "react";
import type { CommandIndexEntry } from "@planevo/core/search/command-model";
import { FILE_FILTER_TABS, type FileFilterTab } from "@planevo/core/types/files";
import { Icon } from "@/components/ui/planevo-icon";
import { cn } from "@/lib/utils";
import {
  buildFileRecents,
  buildFileSuggestions,
  filterFileEntriesByTab,
  SPOTLIGHT_FILE_FILTER_LABELS,
} from "./spotlight-files-browse";

type SpotlightFilesBrowseProps = {
  entries: CommandIndexEntry[];
  recents: CommandIndexEntry[];
  loading?: boolean;
  onSelect: (entry: CommandIndexEntry) => void;
};

function FileTile({
  entry,
  onSelect,
}: {
  entry: CommandIndexEntry;
  onSelect: (entry: CommandIndexEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      aria-label={entry.title}
      className="flex flex-col items-center gap-2 rounded-card p-2 text-center outline-none hover:bg-surface-raised/50 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex size-14 items-center justify-center rounded-card bg-surface-sunken">
        <Icon name="files" className="size-7 text-text-secondary" />
      </span>
      <span className="line-clamp-2 w-full text-small text-ink">{entry.title}</span>
    </button>
  );
}

function FileGrid({
  title,
  files,
  onSelect,
}: {
  title: string;
  files: CommandIndexEntry[];
  onSelect: (entry: CommandIndexEntry) => void;
}) {
  if (files.length === 0) return null;

  return (
    <section className="px-5 pb-4">
      <h4 className="pb-2 text-label uppercase tracking-wide text-text-muted">{title}</h4>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {files.map((entry) => (
          <FileTile key={entry.id} entry={entry} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export function SpotlightFilesBrowse({
  entries,
  recents,
  loading = false,
  onSelect,
}: SpotlightFilesBrowseProps) {
  const [tab, setTab] = useState<FileFilterTab>("all");
  const filtered = filterFileEntriesByTab(entries, tab);
  const suggestions = buildFileSuggestions(filtered, 6);
  const recentFiles = buildFileRecents(
    filtered,
    recents.filter((entry) => entry.kind === "file"),
    12,
  );

  return (
    <div className="max-h-[min(28rem,50vh)] overflow-y-auto py-1">
      <div className="flex items-center gap-2 px-5 pt-3 pb-2">
        <Icon name="files" className="size-5 text-text-secondary" />
        <h3 className="text-h3 font-normal text-ink">Files</h3>
      </div>

      <div
        role="tablist"
        aria-label="File type filters"
        className="flex gap-2 overflow-x-auto px-5 pb-3 scroll-smooth"
      >
        {FILE_FILTER_TABS.map((filterTab) => {
          const active = tab === filterTab;
          return (
            <button
              key={filterTab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(filterTab)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-label outline-none transition-colors motion-reduce:transition-none",
                active
                  ? "border-border bg-surface-raised text-ink ring-1 ring-border"
                  : "border-border/60 bg-transparent text-text-secondary hover:bg-surface-raised/40 hover:text-ink",
              )}
            >
              {SPOTLIGHT_FILE_FILTER_LABELS[filterTab]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="px-5 py-6 text-center text-small text-text-muted">Loading…</p>
      ) : suggestions.length === 0 && recentFiles.length === 0 ? (
        <p className="px-5 py-6 text-center text-small text-text-muted">No files yet.</p>
      ) : (
        <>
          <FileGrid title="Suggestions" files={suggestions} onSelect={onSelect} />
          <FileGrid title="Recents" files={recentFiles} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
