import type { CommandIndexEntry } from "@planevo/core/search/command-model";

export const SPOTLIGHT_SCOPE_STORAGE_KEY = "planevo:spotlight-scope";

export type SpotlightScope = "tasks" | "calendar" | "files" | "workspace";

export const SPOTLIGHT_SCOPE_ITEMS = [
  { scope: "tasks", icon: "tasks", label: "Tasks" },
  { scope: "calendar", icon: "calendar", label: "Calendar" },
  { scope: "files", icon: "files", label: "Files" },
  { scope: "workspace", icon: "workspace", label: "Workspace" },
] as const satisfies ReadonlyArray<{
  scope: SpotlightScope;
  icon: string;
  label: string;
}>;

const VALID_SCOPES = new Set<string>(SPOTLIGHT_SCOPE_ITEMS.map((item) => item.scope));

function scopeForKind(kind: CommandIndexEntry["kind"]): SpotlightScope | null {
  switch (kind) {
    case "task":
      return "tasks";
    case "event":
      return "calendar";
    case "file":
      return "files";
    case "page":
    case "database":
    case "record":
      return "workspace";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function parseStoredScope(raw: string): SpotlightScope | null {
  if (raw === "null") return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string" && VALID_SCOPES.has(parsed)) {
      return parsed as SpotlightScope;
    }
    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (value): value is SpotlightScope =>
          typeof value === "string" && VALID_SCOPES.has(value),
      );
      return first ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export function loadSpotlightScope(): SpotlightScope | null {
  if (typeof sessionStorage === "undefined") return null;

  const raw = sessionStorage.getItem(SPOTLIGHT_SCOPE_STORAGE_KEY);
  if (!raw) return null;
  return parseStoredScope(raw);
}

export function saveSpotlightScope(scope: SpotlightScope | null): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    SPOTLIGHT_SCOPE_STORAGE_KEY,
    scope ? JSON.stringify(scope) : "null",
  );
}

export function setSpotlightScope(
  current: SpotlightScope | null,
  next: SpotlightScope,
): SpotlightScope | null {
  return current === next ? null : next;
}

export function filterEntriesByScope(
  entries: CommandIndexEntry[],
  scope: SpotlightScope | null,
): CommandIndexEntry[] {
  if (!scope) return entries;
  return entries.filter((entry) => scopeForKind(entry.kind) === scope);
}

export function isScopeActive(
  activeScope: SpotlightScope | null,
  scope: SpotlightScope,
): boolean {
  return activeScope === scope;
}

export function scopeLabel(scope: SpotlightScope): string {
  return SPOTLIGHT_SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? scope;
}

function entrySortMs(entry: CommandIndexEntry): number {
  if (!entry.updatedAt) return 0;
  const ms = Date.parse(entry.updatedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Recents first, then index entries (by updatedAt) for scoped empty-query browse. */
export function buildScopedBrowseList(
  recents: CommandIndexEntry[],
  entries: CommandIndexEntry[],
  limit = 20,
): CommandIndexEntry[] {
  const seen = new Set<string>();
  const merged: CommandIndexEntry[] = [];

  for (const entry of recents) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }

  const sortedEntries = [...entries].sort(
    (a, b) => entrySortMs(b) - entrySortMs(a),
  );

  for (const entry of sortedEntries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
    if (merged.length >= limit) break;
  }

  return merged;
}
