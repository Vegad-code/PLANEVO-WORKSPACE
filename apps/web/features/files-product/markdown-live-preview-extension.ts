import { syntaxTree } from "@codemirror/language";
import { type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import {
  MAX_FRONTMATTER_LINES,
  frontmatterLineCount,
  isCollapsibleRange,
  isMarkdownSyntaxMark,
  markdownNodeClass,
  shouldRevealSyntax,
} from "@/lib/files/markdown-live-preview";

/**
 * Paints markdown as prose without ever rewriting it.
 *
 * This is the whole reason the document view is built on CodeMirror decorations instead of a
 * rich-text model: the stored string is never parsed-and-reserialized, so tables, YAML
 * front-matter, raw HTML, and hand-aligned whitespace survive editing byte-for-byte. Decorations
 * only change how existing bytes are painted.
 *
 * Styling rules live in lib/files/markdown-live-preview.ts; this file is just the tree walk.
 */

/**
 * Decorations are built over the WHOLE document, never just the viewport.
 *
 * Collapsing `**` and `#` changes how a line wraps, and therefore how tall it is. If only visible
 * lines were decorated, every line would be measured at one height while off-screen and a
 * different height once scrolled in — so the total content height kept changing underneath the
 * scrollbar and long documents visibly juddered while scrolling.
 *
 * ponytail: whole-document walk, which is O(nodes) per rebuild. Fine to a few hundred KB; above
 * MAX_LIVE_PREVIEW_BYTES we serve plain markdown highlighting instead of paying it on every
 * keystroke. Raise the cap only with a measurement, not a hunch.
 */
const MAX_LIVE_PREVIEW_BYTES = 400_000;

/** Trailing space after `#` or `>` belongs to the marker — hiding one without the other looks broken. */
function markEndWithTrailingSpace(
  lineText: string,
  lineFrom: number,
  from: number,
  to: number,
): number {
  let end = to;
  while (end - lineFrom < lineText.length) {
    const char = lineText[end - lineFrom];
    if (char !== " " && char !== "\t") break;
    end += 1;
  }
  // Never swallow the entire line's content; if the mark ran to the end, leave it as found.
  return end > from ? end : to;
}

/**
 * Two sets, deliberately.
 *
 * `decorations` is everything — prose marks plus the collapsed syntax. `atomic` holds ONLY the
 * collapsed ranges, and is the one handed to EditorView.atomicRanges.
 *
 * Passing the full set as atomic (which this once did) makes every styled range indivisible to
 * the selection, so dragging across a table or a blockquote snaps to the whole block instead of
 * selecting words — because md-table and md-quote span entire blocks. Atomicity is only ever
 * wanted for hidden text, where there is genuinely nothing to put a cursor inside of.
 */
type LivePreviewSets = { decorations: DecorationSet; atomic: DecorationSet };

function buildDecorations(view: EditorView): LivePreviewSets {
  const { state } = view;
  if (state.doc.length > MAX_LIVE_PREVIEW_BYTES) {
    return { decorations: Decoration.none, atomic: Decoration.none };
  }

  const ranges: Array<Range<Decoration>> = [];
  const atomicRanges: Array<Range<Decoration>> = [];
  const selection = state.selection.main;
  const tree = syntaxTree(state);

  // Front matter is claimed before the tree walk. The markdown parser has no notion of it and
  // reads the block plus its closing `---` as a Setext heading, which renders a file's metadata
  // as a giant bold title. Paint it as metadata and skip every node inside it.
  const headLines: string[] = [];
  for (
    let n = 1;
    n <= Math.min(state.doc.lines, MAX_FRONTMATTER_LINES);
    n += 1
  ) {
    headLines.push(state.doc.line(n).text);
  }
  const frontmatterLines = frontmatterLineCount(headLines);
  const frontmatterEnd =
    frontmatterLines > 0 ? state.doc.line(frontmatterLines).to : 0;
  if (frontmatterEnd > 0) {
    ranges.push(
      Decoration.mark({ class: "md-frontmatter" }).range(0, frontmatterEnd),
    );
  }

  tree.iterate({
    enter(node) {
      if (frontmatterEnd > 0) {
        // Prune only nodes lying WHOLLY inside front matter. Testing `from` alone would match the
        // root Document node, which also starts at 0, and pruning that discards the entire tree —
        // every `#`, `**`, and `>` in the file stops collapsing.
        if (node.to <= frontmatterEnd) return false;
        // Straddles the fence: descend to reach real content, but style nothing at this level.
        if (node.from < frontmatterEnd) return;
      }

      const className = markdownNodeClass(node.name);
      if (className && isCollapsibleRange({ from: node.from, to: node.to })) {
        ranges.push(
          Decoration.mark({ class: className }).range(node.from, node.to),
        );
      }

      if (!isMarkdownSyntaxMark(node.name)) return;

      const line = state.doc.lineAt(node.from);
      const reveal = shouldRevealSyntax({
        selectionFrom: selection.from,
        selectionTo: selection.to,
        lineFrom: line.from,
        lineTo: line.to,
      });

      if (reveal) {
        ranges.push(
          Decoration.mark({ class: "md-syntax" }).range(node.from, node.to),
        );
        return;
      }

      const to =
        node.name === "HeaderMark" || node.name === "QuoteMark"
          ? markEndWithTrailingSpace(line.text, line.from, node.from, node.to)
          : node.to;
      if (!isCollapsibleRange({ from: node.from, to })) return;
      const collapsed = Decoration.replace({}).range(node.from, to);
      ranges.push(collapsed);
      // Only hidden text is atomic — see the note on LivePreviewSets.
      atomicRanges.push(collapsed);
    },
  });

  // Sorting is delegated to Decoration.set: a parent node and its first child share a `from`,
  // and RangeSetBuilder would reject them in tree-iteration order.
  return {
    decorations: Decoration.set(ranges, true),
    atomic: Decoration.set(atomicRanges, true),
  };
}

/** The span of lines the selection touches — the only part of the selection decorations care about. */
function revealedLineSpan(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  if (from > doc.length || to > doc.length) return "invalid";
  return `${doc.lineAt(from).number}:${doc.lineAt(to).number}`;
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomic: DecorationSet;
    private lineSpan: string;

    constructor(view: EditorView) {
      const built = buildDecorations(view);
      this.decorations = built.decorations;
      this.atomic = built.atomic;
      this.lineSpan = revealedLineSpan(view);
    }

    update(update: ViewUpdate) {
      const nextSpan = revealedLineSpan(update.view);
      // Moving the caret within one line changes nothing about what is revealed, and rebuilding
      // the whole document on every arrow key was pure waste. Only a doc edit, a reparse, or a
      // move onto a different line can change the decoration set.
      const needsRebuild =
        update.docChanged ||
        nextSpan !== this.lineSpan ||
        syntaxTree(update.startState) !== syntaxTree(update.state);

      if (!needsRebuild) return;
      this.lineSpan = nextSpan;
      const built = buildDecorations(update.view);
      this.decorations = built.decorations;
      this.atomic = built.atomic;
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    // `atomic`, NOT `decorations`. Feeding the full set here makes every styled range
    // indivisible and selection snaps across whole tables and blockquotes. Collapsed syntax
    // still needs it so arrow keys do not stall inside hidden `**`.
    provide: (plugin) =>
      EditorView.atomicRanges.of(
        (view) => view.plugin(plugin)?.atomic ?? Decoration.none,
      ),
  },
);

export function markdownLivePreview(): Extension {
  return livePreviewPlugin;
}
