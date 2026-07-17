/**
 * Deterministic line parser for F-10 retroactive structure and F-13 quick capture.
 * No LLM — same rules everywhere, one place to fix bugs.
 */

export type CapturedRecordDraft = {
  title: string;
  dueDate: string | null;
  priority: string | null;
  status: string | null;
};

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const PRIORITY_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\b(p1|priority\s*1|urgent|critical)\b/i, value: "High" },
  { pattern: /\b(p2|priority\s*2)\b/i, value: "Medium" },
  { pattern: /\b(p3|priority\s*3|low\s+priority)\b/i, value: "Low" },
  { pattern: /\bhigh\s+priority\b/i, value: "High" },
  { pattern: /\bmedium\s+priority\b/i, value: "Medium" },
];

const STATUS_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\b(done|completed|complete)\b/i, value: "Done" },
  { pattern: /\b(in\s+progress|doing|wip)\b/i, value: "In progress" },
  { pattern: /\b(not\s+started|todo|to\s+do)\b/i, value: "Not started" },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function nextWeekday(reference: Date, weekdayIndex: number): Date {
  const base = startOfDay(reference);
  const current = base.getDay();
  let delta = weekdayIndex - current;
  if (delta <= 0) delta += 7;
  return addDays(base, delta);
}

function parseRelativeDate(token: string, reference: Date): Date | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "today") return startOfDay(reference);
  if (normalized === "tomorrow") return addDays(reference, 1);

  const weekdayIndex = WEEKDAY_NAMES.indexOf(normalized as (typeof WEEKDAY_NAMES)[number]);
  if (weekdayIndex >= 0) return nextWeekday(reference, weekdayIndex);

  const parsed = Date.parse(token);
  if (!Number.isNaN(parsed)) return startOfDay(new Date(parsed));

  return null;
}

function extractDateSegment(line: string, reference: Date): {
  title: string;
  dueDate: string | null;
} {
  const emDashMatch = line.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (emDashMatch) {
    const left = emDashMatch[1]!.trim();
    const right = emDashMatch[2]!.trim();
    const due = parseRelativeDate(right, reference);
    if (due) {
      return { title: left, dueDate: due.toISOString() };
    }
  }

  const dueMatch = line.match(/\b(?:due|by)\s+(.+)$/i);
  if (dueMatch) {
    const due = parseRelativeDate(dueMatch[1]!, reference);
    if (due) {
      const title = line.slice(0, dueMatch.index).trim();
      return { title, dueDate: due.toISOString() };
    }
  }

  const trailingWeekday = line.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*$/i,
  );
  if (trailingWeekday) {
    const due = parseRelativeDate(trailingWeekday[1]!, reference);
    if (due) {
      const title = line.slice(0, trailingWeekday.index).trim();
      return { title, dueDate: due.toISOString() };
    }
  }

  return { title: line.trim(), dueDate: null };
}

function matchPattern(
  line: string,
  patterns: { pattern: RegExp; value: string }[],
): { value: string | null; line: string } {
  for (const entry of patterns) {
    const match = line.match(entry.pattern);
    if (!match) continue;
    const cleaned = line.replace(entry.pattern, " ").replace(/\s+/g, " ").trim();
    return { value: entry.value, line: cleaned };
  }
  return { value: null, line };
}

/** Parse one freeform line into structured record fields. */
export function parseNaturalCaptureLine(
  line: string,
  referenceDate: Date = new Date(),
): CapturedRecordDraft {
  let working = line.trim();
  if (!working) {
    return { title: "", dueDate: null, priority: null, status: null };
  }

  const statusMatch = matchPattern(working, STATUS_PATTERNS);
  working = statusMatch.line;

  const priorityMatch = matchPattern(working, PRIORITY_PATTERNS);
  working = priorityMatch.line;

  const dateResult = extractDateSegment(working, referenceDate);

  return {
    title: dateResult.title || working,
    dueDate: dateResult.dueDate,
    priority: priorityMatch.value,
    status: statusMatch.value,
  };
}

/** Parse many lines, skipping blanks. */
export function parseNaturalCaptureLines(
  lines: string[],
  referenceDate: Date = new Date(),
): CapturedRecordDraft[] {
  return lines
    .map((line) => parseNaturalCaptureLine(line, referenceDate))
    .filter((draft) => draft.title.trim().length > 0);
}
