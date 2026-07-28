import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("./markdown-live-preview.ts");
  } catch (error) {
    assert.fail(`Markdown live preview policy must load: ${String(error)}`);
  }
}

/** A line spanning positions 10..20, i.e. `## Status` sitting mid-document. */
const line = { lineFrom: 10, lineTo: 20 };

test("maps heading and emphasis nodes onto prose classes", async () => {
  const { markdownNodeClass } = await loadModule();
  assert.equal(markdownNodeClass("ATXHeading1"), "md-h1");
  assert.equal(markdownNodeClass("StrongEmphasis"), "md-strong");
  assert.equal(markdownNodeClass("InlineCode"), "md-code-inline");
});

test("leaves unknown node types unstyled instead of guessing", async () => {
  const { markdownNodeClass } = await loadModule();
  assert.equal(markdownNodeClass("Document"), null);
  assert.equal(markdownNodeClass(""), null);
});

test("treats punctuation-only marks as collapsible but keeps link brackets", async () => {
  const { isMarkdownSyntaxMark } = await loadModule();
  assert.equal(isMarkdownSyntaxMark("EmphasisMark"), true);
  assert.equal(isMarkdownSyntaxMark("HeaderMark"), true);
  assert.equal(isMarkdownSyntaxMark("CodeMark"), true);
  // Collapsing LinkMark would strand a bare URL in the prose.
  assert.equal(isMarkdownSyntaxMark("LinkMark"), false);
  assert.equal(isMarkdownSyntaxMark("Paragraph"), false);
});

test("reveals syntax while the caret sits inside the line", async () => {
  const { shouldRevealSyntax } = await loadModule();
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 15, selectionTo: 15, ...line }),
    true,
  );
});

test("hides syntax once the caret moves to another line", async () => {
  const { shouldRevealSyntax } = await loadModule();
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 40, selectionTo: 40, ...line }),
    false,
  );
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 0, selectionTo: 3, ...line }),
    false,
  );
});

test("reveals syntax at both line edges so it does not flicker at end of line", async () => {
  const { shouldRevealSyntax } = await loadModule();
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 10, selectionTo: 10, ...line }),
    true,
  );
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 20, selectionTo: 20, ...line }),
    true,
  );
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 21, selectionTo: 21, ...line }),
    false,
  );
});

test("reveals syntax for a selection that spans across the line", async () => {
  const { shouldRevealSyntax } = await loadModule();
  assert.equal(
    shouldRevealSyntax({ selectionFrom: 5, selectionTo: 50, ...line }),
    true,
  );
});

test("handles an empty document without revealing anything spurious", async () => {
  const { shouldRevealSyntax } = await loadModule();
  assert.equal(
    shouldRevealSyntax({
      selectionFrom: 0,
      selectionTo: 0,
      lineFrom: 0,
      lineTo: 0,
    }),
    true,
  );
});

test("refuses zero-length and inverted ranges so CodeMirror never gets a bad decoration", async () => {
  const { isCollapsibleRange } = await loadModule();
  assert.equal(isCollapsibleRange({ from: 4, to: 6 }), true);
  assert.equal(isCollapsibleRange({ from: 4, to: 4 }), false);
  assert.equal(isCollapsibleRange({ from: 6, to: 4 }), false);
});
