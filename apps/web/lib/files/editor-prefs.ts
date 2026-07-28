export const FILE_EDITOR_PREFERENCES_KEY = "planevo.files.editor.v2";

export type DocumentEditorMode = "bottom" | "side" | "full";

/**
 * "document" renders markdown as formatted, editable prose (syntax hidden except on the
 * cursor's line); "markdown" is the raw source view with a gutter; "split" pairs source with
 * the sanitized read-only preview. Legacy values "preview"/"source" migrate onto the first two.
 */
export type MarkdownViewMode = "document" | "markdown" | "split";
export type FileEditorUtilityTab =
  | "closed"
  | "details"
  | "notes"
  | "comments"
  | "history";
export type FileEditorPreferences = {
  mode: DocumentEditorMode;
  sideWidth: number;
  bottomHeight: number;
  utilityHeight: number;
  utilityTab: FileEditorUtilityTab;
  markdownView: MarkdownViewMode;
};

export const DEFAULT_FILE_EDITOR_PREFERENCES: FileEditorPreferences = {
  mode: "full",
  sideWidth: 640,
  bottomHeight: 620,
  utilityHeight: 260,
  utilityTab: "closed",
  markdownView: "document",
};

const MODES = new Set<DocumentEditorMode>(["bottom", "side", "full"]);
const MARKDOWN_VIEWS = new Set<MarkdownViewMode>([
  "document",
  "markdown",
  "split",
]);

/** Stored values from the pre-rebuild editor, which had no editable rendered mode. */
const LEGACY_MARKDOWN_VIEWS: Record<string, MarkdownViewMode> = {
  preview: "document",
  source: "markdown",
};

export function parseMarkdownViewMode(value: unknown): MarkdownViewMode {
  if (typeof value !== "string") {
    return DEFAULT_FILE_EDITOR_PREFERENCES.markdownView;
  }
  if (MARKDOWN_VIEWS.has(value as MarkdownViewMode)) {
    return value as MarkdownViewMode;
  }
  return (
    LEGACY_MARKDOWN_VIEWS[value] ??
    DEFAULT_FILE_EDITOR_PREFERENCES.markdownView
  );
}
const UTILITY_TABS = new Set<FileEditorUtilityTab>([
  "closed",
  "details",
  "notes",
  "comments",
  "history",
]);

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseDocumentEditorMode(
  value: string | null,
): DocumentEditorMode {
  if (value === "panel") return "side";
  return value && MODES.has(value as DocumentEditorMode)
    ? (value as DocumentEditorMode)
    : DEFAULT_FILE_EDITOR_PREFERENCES.mode;
}

export function parseFileEditorPreferences(
  value: string | null,
): FileEditorPreferences {
  if (!value) return { ...DEFAULT_FILE_EDITOR_PREFERENCES };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_FILE_EDITOR_PREFERENCES };
    }
    const record = parsed as Record<string, unknown>;
    return {
      mode:
        typeof record.mode === "string" &&
        MODES.has(record.mode as DocumentEditorMode)
          ? (record.mode as DocumentEditorMode)
          : DEFAULT_FILE_EDITOR_PREFERENCES.mode,
      sideWidth: finiteNumber(
        record.sideWidth,
        DEFAULT_FILE_EDITOR_PREFERENCES.sideWidth,
      ),
      bottomHeight: finiteNumber(
        record.bottomHeight,
        DEFAULT_FILE_EDITOR_PREFERENCES.bottomHeight,
      ),
      utilityHeight: finiteNumber(
        record.utilityHeight,
        DEFAULT_FILE_EDITOR_PREFERENCES.utilityHeight,
      ),
      utilityTab:
        typeof record.utilityTab === "string" &&
        UTILITY_TABS.has(record.utilityTab as FileEditorUtilityTab)
          ? (record.utilityTab as FileEditorUtilityTab)
          : DEFAULT_FILE_EDITOR_PREFERENCES.utilityTab,
      markdownView: parseMarkdownViewMode(record.markdownView),
    };
  } catch {
    return { ...DEFAULT_FILE_EDITOR_PREFERENCES };
  }
}

export function getFileEditorPreferences(): FileEditorPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FILE_EDITOR_PREFERENCES };
  }
  return parseFileEditorPreferences(
    window.localStorage.getItem(FILE_EDITOR_PREFERENCES_KEY),
  );
}

export function setFileEditorPreferences(
  preferences: FileEditorPreferences,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FILE_EDITOR_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
}
