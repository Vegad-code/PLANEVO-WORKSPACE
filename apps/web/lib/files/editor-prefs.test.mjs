import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("./editor-prefs.ts");
  } catch (error) {
    assert.fail(`Files editor preferences must load: ${String(error)}`);
  }
}

test("maps the legacy panel query to the side layout", async () => {
  const { parseDocumentEditorMode } = await loadModule();

  assert.equal(parseDocumentEditorMode("panel"), "side");
  assert.equal(parseDocumentEditorMode("bottom"), "bottom");
  assert.equal(parseDocumentEditorMode("full"), "full");
  assert.equal(parseDocumentEditorMode("unexpected"), "full");
});

test("restores layout, dimensions, and markdown arrangement", async () => {
  const { parseFileEditorPreferences } = await loadModule();

  assert.deepEqual(
    parseFileEditorPreferences(
      JSON.stringify({
        mode: "side",
        sideWidth: 720,
        bottomHeight: 580,
        utilityHeight: 240,
        utilityTab: "notes",
        markdownView: "markdown",
      }),
    ),
    {
      mode: "side",
      sideWidth: 720,
      bottomHeight: 580,
      utilityHeight: 240,
      utilityTab: "notes",
      markdownView: "markdown",
    },
  );
});

test("opens documents full-width in the editable rendered view by default", async () => {
  const { DEFAULT_FILE_EDITOR_PREFERENCES } = await loadModule();

  assert.equal(DEFAULT_FILE_EDITOR_PREFERENCES.mode, "full");
  assert.equal(DEFAULT_FILE_EDITOR_PREFERENCES.markdownView, "document");
});

test("migrates the pre-rebuild view names onto the new modes", async () => {
  const { parseMarkdownViewMode } = await loadModule();

  // The old editor had no editable rendered mode; "preview" was read-only.
  assert.equal(parseMarkdownViewMode("preview"), "document");
  assert.equal(parseMarkdownViewMode("source"), "markdown");
  assert.equal(parseMarkdownViewMode("split"), "split");
  assert.equal(parseMarkdownViewMode("document"), "document");
  assert.equal(parseMarkdownViewMode("nonsense"), "document");
  assert.equal(parseMarkdownViewMode(undefined), "document");
});

test("uses safe defaults for malformed or partial preferences", async () => {
  const {
    DEFAULT_FILE_EDITOR_PREFERENCES,
    parseFileEditorPreferences,
  } = await loadModule();

  assert.deepEqual(
    parseFileEditorPreferences("not-json"),
    DEFAULT_FILE_EDITOR_PREFERENCES,
  );
  assert.deepEqual(
    parseFileEditorPreferences('{"mode":"floating","sideWidth":"wide"}'),
    DEFAULT_FILE_EDITOR_PREFERENCES,
  );
});
