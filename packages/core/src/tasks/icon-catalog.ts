import catalogJson from "./icon-catalog.json" with { type: "json" };
import { fuzzyMatch } from "../search/fuzzy.ts";
import { getEmojiCatalogEntry } from "./emoji-catalog.ts";
import { getTaskIconDefinition } from "./task-icon-registry.ts";
import type { TaskIconDefinition } from "./task-icon-types.ts";
import { parseEmojiFromId } from "./task-icon-types.ts";

export type CatalogIcon = {
  id: string;
  library: "solid" | "regular";
  iconName: string;
  label: string;
  searchText: string;
  svgPath: string;
  width: number;
  height: number;
};

export const ICON_CATALOG = catalogJson as CatalogIcon[];

const CATALOG_BY_ID = new Map<string, CatalogIcon>(
  ICON_CATALOG.map((entry) => [entry.id, entry]),
);

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "do",
  "my",
  "for",
  "and",
  "or",
  "on",
  "in",
  "at",
  "of",
  "is",
  "it",
  "up",
  "get",
  "make",
]);

export function getCatalogIcon(id: string): CatalogIcon | null {
  return CATALOG_BY_ID.get(id) ?? null;
}

export function isCatalogIconId(id: string): boolean {
  return CATALOG_BY_ID.has(id);
}

export function resolveIconDefinition(
  id: string,
  emoji?: string,
): TaskIconDefinition | null {
  const resolvedEmoji = emoji ?? parseEmojiFromId(id);
  if (id.startsWith("emoji:") && resolvedEmoji) {
    const entry = getEmojiCatalogEntry(resolvedEmoji);
    return {
      id,
      label: entry?.label ?? resolvedEmoji,
      library: "emoji",
      name: resolvedEmoji,
      emoji: resolvedEmoji,
    };
  }

  const registry = getTaskIconDefinition(id);
  if (registry) return registry;

  const catalog = getCatalogIcon(id);
  if (!catalog) return null;

  return {
    id: catalog.id,
    label: catalog.label,
    library: "fontawesome",
    name: catalog.iconName,
    catalog,
  };
}

export function tokenizeIntentText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_/.,!?;:()]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function searchIconCatalog(
  query: string,
  limit = 20,
): CatalogIcon[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const tokens = tokenizeIntentText(trimmed);
  const searchTerms =
    tokens.length > 0 ? tokens : trimmed.split(/\s+/).filter(Boolean);

  const scored: { icon: CatalogIcon; score: number }[] = [];

  for (const icon of ICON_CATALOG) {
    let best = 0;

    for (const term of searchTerms) {
      const labelMatch = fuzzyMatch(term, icon.label);
      const textMatch = fuzzyMatch(term, icon.searchText);
      const nameMatch = fuzzyMatch(term, icon.iconName.replace(/-/g, " "));
      const localBest = Math.max(
        labelMatch?.score ?? -1,
        textMatch?.score ?? -1,
        nameMatch?.score ?? -1,
      );
      if (localBest > best) best = localBest;
    }

    const fullMatch = fuzzyMatch(trimmed, icon.searchText);
    if (fullMatch) best = Math.max(best, fullMatch.score + 5);

    if (best >= 0) scored.push({ icon, score: best });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.icon.label.localeCompare(b.icon.label))
    .slice(0, limit)
    .map((row) => row.icon);
}

export function bestCatalogIconForText(
  text: string,
  minScore = 22,
): CatalogIcon | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 2) return null;

  const tokens = tokenizeIntentText(trimmed);
  const searchTerms =
    tokens.length > 0 ? tokens : trimmed.split(/\s+/).filter(Boolean);

  let bestIcon: CatalogIcon | null = null;
  let bestScore = -1;

  for (const icon of ICON_CATALOG) {
    let score = 0;

    for (const term of searchTerms) {
      const labelMatch = fuzzyMatch(term, icon.label);
      const textMatch = fuzzyMatch(term, icon.searchText);
      const nameMatch = fuzzyMatch(term, icon.iconName.replace(/-/g, " "));
      score = Math.max(
        score,
        labelMatch?.score ?? -1,
        textMatch?.score ?? -1,
        nameMatch?.score ?? -1,
      );
    }

    const fullMatch = fuzzyMatch(trimmed, icon.searchText);
    if (fullMatch) score = Math.max(score, fullMatch.score + 5);

    if (score > bestScore) {
      bestScore = score;
      bestIcon = icon;
    }
  }

  if (!bestIcon || bestScore < minScore) return null;
  return bestIcon;
}
