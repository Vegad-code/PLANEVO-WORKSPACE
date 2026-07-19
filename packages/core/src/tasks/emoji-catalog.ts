import catalogJson from "./emoji-catalog.json" with { type: "json" };
import { fuzzyMatch } from "../search/fuzzy.ts";

export type EmojiCatalogEntry = {
  emoji: string;
  label: string;
  searchText: string;
  category: string;
};

export const EMOJI_CATALOG = catalogJson as EmojiCatalogEntry[];

const BY_EMOJI = new Map<string, EmojiCatalogEntry>(
  EMOJI_CATALOG.map((entry) => [entry.emoji, entry]),
);

export function getEmojiCatalogEntry(emoji: string): EmojiCatalogEntry | null {
  return BY_EMOJI.get(emoji) ?? null;
}

export function searchEmojiCatalog(query: string, limit = 24): EmojiCatalogEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 1) return EMOJI_CATALOG.slice(0, limit);

  const scored: { entry: EmojiCatalogEntry; score: number }[] = [];

  for (const entry of EMOJI_CATALOG) {
    const labelMatch = fuzzyMatch(trimmed, entry.label);
    const textMatch = fuzzyMatch(trimmed, entry.searchText);
    const score = Math.max(labelMatch?.score ?? -1, textMatch?.score ?? -1);
    if (score >= 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
    .map((row) => row.entry);
}

export function bestEmojiForText(text: string, minScore = 18): EmojiCatalogEntry | null {
  const results = searchEmojiCatalog(text, 1);
  if (!results[0]) return null;
  const check = fuzzyMatch(text.toLowerCase(), results[0].searchText);
  if ((check?.score ?? -1) < minScore) return null;
  return results[0];
}
