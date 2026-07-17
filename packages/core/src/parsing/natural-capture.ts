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

export type QuickCaptureDraft = CapturedRecordDraft & {
  /** Local wall-clock time, if the line named one. */
  time: { hour: number; minute: number } | null;
  /** Raw `#token` (destination database); resolution happens elsewhere. */
  databaseToken: string | null;
  /** Raw `@token` (person mention). */
  personToken: string | null;
  priorityToken: "low" | "medium" | "high" | null;
  /** `every <weekday>` was seen — consumed, but recurrence is not scheduled. */
  recurringUnsupported: boolean;
  /** Half-open [start, end) spans consumed from the original line, for chips. */
  consumedRanges: [number, number][];
};

const PRIORITY_TOKEN_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Parse one command-bar line into a quick-capture draft (F-13). Extends the
 * record-draft fields with time, destination/person tokens, priority token,
 * a recurring flag, and the consumed character spans for live highlight chips.
 * Deterministic, no deps, local timezone via `referenceDate`.
 */
export function parseQuickCapture(
  line: string,
  referenceDate: Date = new Date(),
): QuickCaptureDraft {
  let working = line;
  const consumed: [number, number][] = [];

  function blank(start: number, end: number): void {
    consumed.push([start, end]);
    working = working.slice(0, start) + " ".repeat(end - start) + working.slice(end);
  }

  function take(regex: RegExp): RegExpExecArray | null {
    const match = regex.exec(working);
    if (!match) return null;
    blank(match.index, match.index + match[0].length);
    return match;
  }

  // Recurring first, so "every monday" is never read as a due weekday.
  const recurringMatch = take(
    /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  const recurringUnsupported = recurringMatch !== null;

  const priorityMatch = take(/!!|!(high|medium|low)\b/i);
  let priorityToken: "low" | "medium" | "high" | null = null;
  if (priorityMatch) {
    priorityToken = priorityMatch[1]
      ? (priorityMatch[1].toLowerCase() as "low" | "medium" | "high")
      : "high";
  }

  const dbMatch = take(/#([A-Za-z0-9][\w-]*)/);
  const databaseToken = dbMatch ? dbMatch[1]! : null;
  const personMatch = take(/@([A-Za-z0-9][\w-]*)/);
  const personToken = personMatch ? personMatch[1]! : null;

  // Time (specific presets before numeric forms).
  let time: { hour: number; minute: number } | null = null;
  if (take(/\b(?:at\s+)?noon\b/i)) time = { hour: 12, minute: 0 };
  if (!time && take(/\b(?:at\s+)?midnight\b/i)) time = { hour: 0, minute: 0 };
  if (!time) {
    const twelve = take(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])m\b/i);
    if (twelve) {
      let hour = parseInt(twelve[1]!, 10) % 12;
      if (twelve[3]!.toLowerCase() === "p") hour += 12;
      time = { hour, minute: twelve[2] ? parseInt(twelve[2], 10) : 0 };
    }
  }
  if (!time) {
    const twentyFour = take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (twentyFour) {
      time = { hour: parseInt(twentyFour[1]!, 10), minute: parseInt(twentyFour[2]!, 10) };
    }
  }

  // Dates (relative forms, optional "due"/"by" keyword consumed with them).
  const DUE = "(?:due\\s+|by\\s+)?";
  let dueDate: string | null = null;

  const inDays = take(new RegExp(`\\b${DUE}in\\s+(\\d+)\\s+days?\\b`, "i"));
  if (inDays) dueDate = addDays(referenceDate, parseInt(inDays[1]!, 10)).toISOString();

  if (!dueDate) {
    const nextWeekdayMatch = take(
      new RegExp(`\\b${DUE}next\\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b`, "i"),
    );
    if (nextWeekdayMatch) {
      const index = WEEKDAY_NAMES.indexOf(
        nextWeekdayMatch[1]!.toLowerCase() as (typeof WEEKDAY_NAMES)[number],
      );
      const coming = nextWeekday(referenceDate, index);
      const base = startOfDay(referenceDate);
      const weekEnd = addDays(base, 6 - base.getDay()); // upcoming Saturday
      dueDate = (coming <= weekEnd ? addDays(coming, 7) : coming).toISOString();
    }
  }

  if (!dueDate) {
    const tmrw = take(new RegExp(`\\b${DUE}(tmrw|tomorrow)\\b`, "i"));
    if (tmrw) dueDate = addDays(referenceDate, 1).toISOString();
  }
  if (!dueDate) {
    const today = take(new RegExp(`\\b${DUE}today\\b`, "i"));
    if (today) dueDate = startOfDay(referenceDate).toISOString();
  }
  if (!dueDate) {
    const weekday = take(
      new RegExp(`\\b${DUE}(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b`, "i"),
    );
    if (weekday) {
      const index = WEEKDAY_NAMES.indexOf(
        weekday[1]!.toLowerCase() as (typeof WEEKDAY_NAMES)[number],
      );
      dueDate = nextWeekday(referenceDate, index).toISOString();
    }
  }

  const title = working.replace(/\s+/g, " ").trim();

  return {
    title,
    dueDate,
    priority: priorityToken ? PRIORITY_TOKEN_LABEL[priorityToken] : null,
    status: null,
    time,
    databaseToken,
    personToken,
    priorityToken,
    recurringUnsupported,
    consumedRanges: consumed.sort((a, b) => a[0] - b[0]),
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
