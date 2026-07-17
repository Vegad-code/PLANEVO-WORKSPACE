/**
 * Pure model behind the one Cmd+K surface (F-13 quick capture + F-46 command
 * bar). Modes are chosen by the query's leading character:
 *   ""  -> recents
 *   ">" -> commands
 *   "@" -> records
 *   "#" -> databases
 *   else -> fuzzy nav across pages/databases/records, with a capture row FIRST
 *           when the parsed line carries a signal (date, time, priority, #db,
 *           or @person).
 * All ranking runs through fuzzy.ts; capture runs through the shared parser.
 */

import { parseQuickCapture, type QuickCaptureDraft } from "../parsing/natural-capture.ts";
import { fuzzyMatch } from "./fuzzy.ts";

export type CommandIndexEntry = {
  kind: "page" | "database" | "record";
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
};

export type CommandDef = { id: string; title: string };

export const COMMANDS: CommandDef[] = [
  { id: "new-page", title: "New page" },
  { id: "new-database", title: "New database" },
  { id: "settings", title: "Settings" },
  { id: "toggle-minimal", title: "Toggle minimal mode" },
  { id: "search-page", title: "Search this page" },
];

export type CommandResultItem =
  | { type: "capture"; draft: QuickCaptureDraft }
  | { type: "command"; command: CommandDef; ranges: [number, number][] }
  | { type: "entry"; entry: CommandIndexEntry; ranges: [number, number][] };

export type CommandInput = {
  query: string;
  entries: CommandIndexEntry[];
  recents?: CommandIndexEntry[];
  referenceDate?: Date;
};

function hasCaptureSignal(draft: QuickCaptureDraft): boolean {
  return Boolean(
    draft.dueDate ||
      draft.time ||
      draft.priorityToken ||
      draft.databaseToken ||
      draft.personToken,
  );
}

function rankCommands(term: string): CommandResultItem[] {
  if (term === "") return COMMANDS.map((command) => ({ type: "command", command, ranges: [] }));
  const scored: { command: CommandDef; score: number; ranges: [number, number][] }[] = [];
  for (const command of COMMANDS) {
    const match = fuzzyMatch(term, command.title);
    if (match) scored.push({ command, score: match.score, ranges: match.ranges });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ command, ranges }) => ({ type: "command", command, ranges }));
}

function rankEntries(entries: CommandIndexEntry[], term: string): CommandResultItem[] {
  if (term === "") return entries.map((entry) => ({ type: "entry", entry, ranges: [] }));
  const scored: { entry: CommandIndexEntry; score: number; ranges: [number, number][] }[] = [];
  for (const entry of entries) {
    const match = fuzzyMatch(term, entry.title);
    if (match) scored.push({ entry, score: match.score, ranges: match.ranges });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ entry, ranges }) => ({ type: "entry", entry, ranges }));
}

export function buildCommandResults(input: CommandInput): CommandResultItem[] {
  const raw = input.query;
  const query = raw.trim();

  if (query === "") {
    return (input.recents ?? []).map((entry) => ({ type: "entry", entry, ranges: [] }));
  }

  if (query.startsWith(">")) return rankCommands(query.slice(1).trim());
  if (query.startsWith("@")) {
    return rankEntries(
      input.entries.filter((entry) => entry.kind === "record"),
      query.slice(1).trim(),
    );
  }
  if (query.startsWith("#")) {
    return rankEntries(
      input.entries.filter((entry) => entry.kind === "database"),
      query.slice(1).trim(),
    );
  }

  const results: CommandResultItem[] = [];
  const draft = parseQuickCapture(raw, input.referenceDate);
  if (hasCaptureSignal(draft)) results.push({ type: "capture", draft });
  results.push(...rankEntries(input.entries, query));
  return results;
}
