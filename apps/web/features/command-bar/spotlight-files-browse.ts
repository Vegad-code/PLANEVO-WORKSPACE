import type { CommandIndexEntry } from "@planevo/core/search/command-model";
import {
  matchesFileFilterTab,
  type FileFilterTab,
} from "@planevo/core/types/files";

function fileEntries(entries: CommandIndexEntry[]): CommandIndexEntry[] {
  return entries.filter((entry) => entry.kind === "file");
}

export function filterFileEntriesByTab(
  entries: CommandIndexEntry[],
  tab: FileFilterTab,
): CommandIndexEntry[] {
  return fileEntries(entries).filter((entry) =>
    matchesFileFilterTab(entry.mimeType ?? null, tab),
  );
}

function updatedAtMs(entry: CommandIndexEntry): number {
  if (!entry.updatedAt) return 0;
  const ms = Date.parse(entry.updatedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

export function buildFileSuggestions(
  entries: CommandIndexEntry[],
  limit = 6,
): CommandIndexEntry[] {
  return [...fileEntries(entries)]
    .sort((a, b) => {
      const starredDelta = Number(Boolean(b.starred)) - Number(Boolean(a.starred));
      if (starredDelta !== 0) return starredDelta;
      return updatedAtMs(b) - updatedAtMs(a);
    })
    .slice(0, limit);
}

export function buildFileRecents(
  entries: CommandIndexEntry[],
  commandRecents: CommandIndexEntry[],
  limit = 12,
): CommandIndexEntry[] {
  const byId = new Map<string, CommandIndexEntry>();

  for (const recent of commandRecents) {
    if (recent.kind !== "file") continue;
    byId.set(recent.id, recent);
  }

  for (const entry of fileEntries(entries)) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }

  const orderedIds = [
    ...commandRecents.filter((entry) => entry.kind === "file").map((entry) => entry.id),
    ...fileEntries(entries)
      .sort((a, b) => updatedAtMs(b) - updatedAtMs(a))
      .map((entry) => entry.id),
  ];

  const merged: CommandIndexEntry[] = [];
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const entry = byId.get(id);
    if (!entry) continue;
    seen.add(id);
    merged.push(entry);
    if (merged.length >= limit) break;
  }

  return merged;
}

export const SPOTLIGHT_FILE_FILTER_LABELS: Record<FileFilterTab, string> = {
  all: "All",
  documents: "Documents",
  pdfs: "PDFs",
  images: "Images",
};
