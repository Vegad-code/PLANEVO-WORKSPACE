export type MarkdownCommand =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bold"
  | "italic"
  | "strikethrough"
  | "link"
  | "inline-code"
  | "code-block"
  | "quote"
  | "bullet-list"
  | "numbered-list"
  | "check-list";

export type MarkdownCommandResult = {
  text: string;
  selection: { from: number; to: number };
};

export type MarkdownListContinuationResult = {
  text: string;
  cursor: number;
};

const WRAPPERS: Partial<
  Record<MarkdownCommand, { before: string; after: string; placeholder: string }>
> = {
  bold: { before: "**", after: "**", placeholder: "bold text" },
  italic: { before: "_", after: "_", placeholder: "italic text" },
  strikethrough: { before: "~~", after: "~~", placeholder: "struck text" },
  link: { before: "[", after: "](https://)", placeholder: "link text" },
  "inline-code": { before: "`", after: "`", placeholder: "code" },
  "code-block": {
    before: "```\n",
    after: "\n```",
    placeholder: "code",
  },
};

const LINE_PREFIXES: Partial<Record<MarkdownCommand, string>> = {
  "heading-1": "# ",
  "heading-2": "## ",
  "heading-3": "### ",
  quote: "> ",
  "bullet-list": "- ",
  "check-list": "- [ ] ",
};

function selectedLineRange(text: string, from: number, to: number) {
  const lineStart = text.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
  const nextBreak = text.indexOf("\n", to);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { lineStart, lineEnd };
}

export function applyMarkdownCommand({
  text,
  from,
  to,
  command,
}: {
  text: string;
  from: number;
  to: number;
  command: MarkdownCommand;
}): MarkdownCommandResult {
  const safeFrom = Math.max(0, Math.min(from, text.length));
  const safeTo = Math.max(safeFrom, Math.min(to, text.length));
  const wrapper = WRAPPERS[command];
  if (wrapper) {
    const selected = text.slice(safeFrom, safeTo) || wrapper.placeholder;
    const replacement = `${wrapper.before}${selected}${wrapper.after}`;
    return {
      text: `${text.slice(0, safeFrom)}${replacement}${text.slice(safeTo)}`,
      selection: {
        from: safeFrom + wrapper.before.length,
        to: safeFrom + wrapper.before.length + selected.length,
      },
    };
  }

  const { lineStart, lineEnd } = selectedLineRange(text, safeFrom, safeTo);
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const prefixed = lines
    .map((line, index) => {
      const prefix =
        command === "numbered-list"
          ? `${index + 1}. `
          : (LINE_PREFIXES[command] ?? "");
      return `${prefix}${line}`;
    })
    .join("\n");
  const insertedPrefixLength = prefixed.length - (lineEnd - lineStart);
  return {
    text: `${text.slice(0, lineStart)}${prefixed}${text.slice(lineEnd)}`,
    selection: {
      from: safeFrom + (command === "numbered-list" ? 3 : (LINE_PREFIXES[command]?.length ?? 0)),
      to: safeTo + insertedPrefixLength,
    },
  };
}

/**
 * Which commands are already applied at the selection, so the toolbar can render pressed states.
 *
 * This is a deliberately shallow text scan, not a parse: wrappers are detected by looking at the
 * characters immediately outside the selection, and line commands by the prefix on the selection's
 * first line. That matches what the user sees on one line of prose and costs nothing per
 * keystroke. It does not attempt nested or multi-line emphasis — a wrong pressed state is a
 * cosmetic miss, whereas parsing the document on every selection change would not be free.
 */
export function activeMarkdownMarks({
  text,
  from,
  to,
}: {
  text: string;
  from: number;
  to: number;
}): ReadonlySet<MarkdownCommand> {
  const safeFrom = Math.max(0, Math.min(from, text.length));
  const safeTo = Math.max(safeFrom, Math.min(to, text.length));
  const active = new Set<MarkdownCommand>();

  for (const [command, wrapper] of Object.entries(WRAPPERS) as Array<
    [MarkdownCommand, { before: string; after: string }]
  >) {
    const before = text.slice(
      Math.max(0, safeFrom - wrapper.before.length),
      safeFrom,
    );
    const after = text.slice(safeTo, safeTo + wrapper.after.length);
    if (before === wrapper.before && after === wrapper.after) {
      active.add(command);
    }
  }

  const { lineStart } = selectedLineRange(text, safeFrom, safeTo);
  const nextBreak = text.indexOf("\n", lineStart);
  const firstLine = text.slice(
    lineStart,
    nextBreak === -1 ? text.length : nextBreak,
  );

  // Longest prefix first: "- [ ] " also starts with "- ", so checklists must win over bullets.
  const linePrefixes = Object.entries(LINE_PREFIXES).sort(
    ([, a], [, b]) => b.length - a.length,
  ) as Array<[MarkdownCommand, string]>;
  for (const [command, prefix] of linePrefixes) {
    if (firstLine.startsWith(prefix)) {
      active.add(command);
      break;
    }
  }
  if (/^\d+\. /.test(firstLine)) active.add("numbered-list");

  return active;
}

export function continueMarkdownList({
  text,
  cursor,
}: {
  text: string;
  cursor: number;
}): MarkdownListContinuationResult | null {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeCursor - 1)) + 1;
  const beforeCursor = text.slice(lineStart, safeCursor);
  const match = beforeCursor.match(
    /^(\s*)(?:(\d+)\.|(- \[[ xX]\])|([-*]))\s+(.*)$/,
  );
  if (!match) return null;

  const [, indent, number, checklist, bullet, content] = match;
  if (!content.trim()) {
    return {
      text: `${text.slice(0, lineStart)}${text.slice(safeCursor)}`,
      cursor: lineStart,
    };
  }

  const marker = number
    ? `${Number(number) + 1}.`
    : checklist
      ? "- [ ]"
      : (bullet ?? "-");
  const insertion = `\n${indent}${marker} `;
  return {
    text: `${text.slice(0, safeCursor)}${insertion}${text.slice(safeCursor)}`,
    cursor: safeCursor + insertion.length,
  };
}
