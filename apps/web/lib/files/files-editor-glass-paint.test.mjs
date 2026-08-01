/**
 * Contract (root cause #1): Files liquid glass must not put backdrop-filter on
 * the scroll-host shell. Frost belongs on ::before so scrollers paint reliably.
 *
 * Pair with codemirror-viewport-measure.test.mjs (root cause #2: CM remasure +
 * value sync). Together they guard the Document/Markdown empty-viewport bug.
 *
 * @see docs/superpowers/specs/2026-07-31-document-viewport-text-paint-design.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GLOBALS = join(WEB_ROOT, "app/globals.css");

const FROSTED_SHELL_SELECTOR =
  ".files-editor-shell.files-editor-shell--full:not(.files-editor-shell--bleed),\n.files-editor-shell.files-editor-shell--side,\n.files-editor-shell.files-editor-shell--bottom,\n[data-liquid-glass=\"on\"] .files-editor-shell:not(.files-editor-shell--bleed) {";

const FROSTED_SHELL_BEFORE_SELECTOR =
  ".files-editor-shell.files-editor-shell--full:not(.files-editor-shell--bleed)::before,\n.files-editor-shell.files-editor-shell--side::before,\n.files-editor-shell.files-editor-shell--bottom::before,\n[data-liquid-glass=\"on\"] .files-editor-shell:not(.files-editor-shell--bleed)::before {";

function extractBlock(css, startMarker) {
  const start = css.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  // Walk to the matching closing brace of the first rule after the marker.
  const brace = css.indexOf("{", start);
  assert.ok(brace > start, "missing opening brace");
  let depth = 0;
  for (let i = brace; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  assert.fail("unclosed block");
}

describe("files editor glass paint contract", () => {
  const css = readFileSync(GLOBALS, "utf8");

  it("does not put backdrop-filter on the frosted shell (scroll-host ancestor paint holes)", () => {
    const block = extractBlock(css, FROSTED_SHELL_SELECTOR);
    assert.equal(
      /backdrop-filter\s*:/.test(block),
      false,
      "shell element must not declare backdrop-filter — put frost on ::before",
    );
    assert.equal(
      /-webkit-backdrop-filter\s*:/.test(block),
      false,
      "shell element must not declare -webkit-backdrop-filter either",
    );
    assert.match(block, /isolation\s*:\s*isolate/);
  });

  it("paints frost on ::before behind scrollers so markdown/preview glyphs are not click-to-reveal", () => {
    const block = extractBlock(css, FROSTED_SHELL_BEFORE_SELECTOR);
    assert.match(block, /backdrop-filter\s*:/);
    assert.match(block, /-webkit-backdrop-filter\s*:/);
    assert.match(block, /z-index\s*:\s*-1/);
    assert.match(block, /pointer-events\s*:\s*none/);
    assert.match(block, /position\s*:\s*absolute/);
    assert.match(block, /inset\s*:\s*0/);
  });

  it("keeps liquid glass on the frost pseudo (blur + saturate + glass fill), not a solid-only shell", () => {
    const block = extractBlock(css, FROSTED_SHELL_BEFORE_SELECTOR);
    assert.match(
      block,
      /backdrop-filter\s*:\s*blur\(\s*var\(--blur-files-editor-glass\)\s*\)/,
    );
    assert.match(block, /saturate\(\s*var\(--saturate-files-editor-glass\)\s*\)/);
    assert.match(block, /background\s*:\s*var\(--color-files-editor-glass\)/);
  });

  it("suppresses nested shell ::before so frost is not double-stacked", () => {
    assert.match(
      css,
      /\[data-liquid-glass="on"\]\s+\.files-editor-shell\s+\.files-editor-shell::before[\s\S]*?\{[^}]*(?:content\s*:\s*none|display\s*:\s*none)/,
    );
  });

  it("turns frost off with data-liquid-glass=off so reduced-glass paths stay solid", () => {
    assert.match(
      css,
      /\[data-liquid-glass="off"\][\s\S]*?\.files-editor-shell[^{]*::before[\s\S]*?\{[^}]*(?:content\s*:\s*none|display\s*:\s*none)/,
    );
  });

  it("keeps Notion page gutters off .cm-scroller (CM height-oracle footgun)", () => {
    const start = css.indexOf("Notion page column");
    const end = css.indexOf("Full-bleed");
    assert.ok(start >= 0 && end > start, "expected Notion page column section");
    const section = css.slice(start, end);
    assert.equal(
      /\.files-doc-prose\s+\.cm-scroller/.test(section),
      false,
      "do not put page gutters on .files-doc-prose .cm-scroller",
    );
    assert.match(
      css,
      /\.files-doc-prose\s+\.cm-content\s*\{[^}]*max-width\s*:\s*var\(--files-doc-page-width\)/s,
    );
  });
});
