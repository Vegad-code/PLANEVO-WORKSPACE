/**
 * Policy for the "document" markdown view: which Lezer node types get which prose class, and
 * when the raw syntax characters (`**`, `#`, backticks) are hidden versus revealed.
 *
 * This file is deliberately free of CodeMirror imports so the rules stay testable without a
 * browser — the syntax-tree walk lives in the view plugin and calls into here. All offsets are
 * absolute document positions, matching what `syntaxTree().iterate()` reports.
 *
 * Node names come from @lezer/markdown (a transitive dependency of @codemirror/lang-markdown).
 */

/** Block and inline nodes that get a prose style. Anything absent renders as plain body text. */
export const MARKDOWN_NODE_CLASS: Readonly<Record<string, string>> = {
  ATXHeading1: "md-h1",
  ATXHeading2: "md-h2",
  ATXHeading3: "md-h3",
  ATXHeading4: "md-h4",
  ATXHeading5: "md-h4",
  ATXHeading6: "md-h4",
  SetextHeading1: "md-h1",
  SetextHeading2: "md-h2",
  StrongEmphasis: "md-strong",
  Emphasis: "md-em",
  Strikethrough: "md-strike",
  InlineCode: "md-code-inline",
  FencedCode: "md-code-block",
  CodeBlock: "md-code-block",
  Blockquote: "md-quote",
  Link: "md-link",
  URL: "md-link",
  HorizontalRule: "md-rule",
  Table: "md-table",
  TableHeader: "md-table-header",
  ListItem: "md-list-item",
  BulletList: "md-list",
  OrderedList: "md-list",
  TaskMarker: "md-task-marker",
};

/**
 * Nodes whose entire text is punctuation that carries no meaning once formatting is painted —
 * these are the ranges we collapse. `HeaderMark` covers `#` runs and Setext underlines,
 * `EmphasisMark` covers `*`/`_`, `CodeMark` backticks, `QuoteMark` the `>`.
 *
 * `LinkMark` (`[`, `]`, `(`, `)`) is intentionally NOT here: collapsing it would leave the bare
 * URL sitting in the prose, which reads worse than the brackets do.
 */
export const MARKDOWN_SYNTAX_MARKS: ReadonlySet<string> = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "QuoteMark",
  "StrikethroughMark",
  "CodeInfo",
]);

export function markdownNodeClass(nodeName: string): string | null {
  return MARKDOWN_NODE_CLASS[nodeName] ?? null;
}

/** Front matter never runs on for pages; only scan the head of the document for the closing fence. */
export const MAX_FRONTMATTER_LINES = 200;

/**
 * Number of leading lines that form a YAML front-matter block, including both `---` fences, or 0.
 *
 * This exists because @lezer/markdown has no concept of front matter: it sees the `key: value`
 * lines followed by the closing `---` and parses the whole thing as a Setext H2, so an untreated
 * document renders its metadata as a giant bold heading with `tags: [a, b]` styled as a link.
 * Detecting the block lets the view plugin paint it as metadata instead.
 *
 * Requires the opening fence on line 1 (per YAML/Jekyll convention) and a closing `---` or `...`.
 * An unterminated block returns 0 — a lone `---` at the top of a file is a horizontal rule, and
 * treating the entire document as front matter would blank the whole view.
 */
export function frontmatterLineCount(lines: readonly string[]): number {
  if (lines.length < 2 || lines[0]?.trim() !== "---") return 0;
  const limit = Math.min(lines.length, MAX_FRONTMATTER_LINES);
  for (let index = 1; index < limit; index += 1) {
    const text = lines[index]?.trim();
    if (text === "---" || text === "...") return index + 1;
  }
  return 0;
}

export function isMarkdownSyntaxMark(nodeName: string): boolean {
  return MARKDOWN_SYNTAX_MARKS.has(nodeName);
}

/**
 * Syntax reveals when the caret or selection touches the line the mark sits on, so editing is
 * never blind — you always see the `**` you are about to type inside. Everywhere else it stays
 * collapsed. `lineFrom`/`lineTo` are the bounds of the line containing the mark.
 *
 * Touching counts as overlap OR adjacency: a caret resting exactly at the line end still reveals
 * that line, otherwise the syntax would flicker away the instant you reach the end of a heading.
 */
export function shouldRevealSyntax({
  selectionFrom,
  selectionTo,
  lineFrom,
  lineTo,
}: {
  selectionFrom: number;
  selectionTo: number;
  lineFrom: number;
  lineTo: number;
}): boolean {
  return selectionTo >= lineFrom && selectionFrom <= lineTo;
}

/**
 * A zero-length mark cannot be collapsed (nothing to replace) and an inverted range means the
 * tree walk handed us garbage — either way, skip rather than dispatch a bad decoration, which
 * CodeMirror would throw on.
 */
export function isCollapsibleRange({
  from,
  to,
}: {
  from: number;
  to: number;
}): boolean {
  return to > from;
}
