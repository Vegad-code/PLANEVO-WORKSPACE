import type { CommandIndexEntry } from "@planevo/core/search/command-model";

const RECENTS_KEY = "planevo.command.recents.v1";
const MAX_RECENTS = 8;

export function loadCommandRecents(): CommandIndexEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CommandIndexEntry =>
          typeof item === "object" &&
          item !== null &&
          "kind" in item &&
          "id" in item &&
          "title" in item &&
          (item.kind === "page" || item.kind === "database" || item.kind === "record") &&
          typeof item.id === "string" &&
          typeof item.title === "string",
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function rememberCommandEntry(entry: CommandIndexEntry): void {
  const existing = loadCommandRecents().filter(
    (item) => !(item.kind === entry.kind && item.id === entry.id),
  );
  const next = [entry, ...existing].slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
