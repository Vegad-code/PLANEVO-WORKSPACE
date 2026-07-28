"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  gotoLine,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  applyMarkdownCommand,
  continueMarkdownList,
  type MarkdownCommand,
} from "@/lib/files/markdown-commands";
import type { MarkdownViewMode } from "@/lib/files/editor-prefs";
import { MarkdownBubbleToolbar } from "./markdown-bubble-toolbar";
import { markdownLivePreview } from "./markdown-live-preview-extension";

/**
 * Markdown and plain-text editing for the Files product.
 *
 * Three markdown views share one CodeMirror instance and differ only by extension list:
 * "document" paints prose and hides syntax, "markdown" is the raw source view with a gutter, and
 * "split" pairs source with the sanitized read-only preview. Formatting is offered exclusively
 * through the selection-anchored bubble toolbar — there is no persistent toolbar, which is what
 * kept two of them on screen at once before.
 *
 * The view-mode switcher itself lives in the editor chrome, not here.
 */

/**
 * CodeMirror's baseTheme colours the drawn selection through
 * `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`. Overriding it
 * requires matching that specificity, in both the focused and unfocused states.
 */
const SELECTION_LAYER_SELECTOR = [
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground",
  "> .cm-scroller > .cm-selectionLayer .cm-selectionBackground",
].join(", ");

/** Chrome shared by both variants; per-variant rules are layered on top. */
const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--color-files-text)",
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-panels": {
    backgroundColor: "var(--color-files-editor-solid)",
    color: "var(--color-files-text)",
  },
  ".cm-searchMatch": {
    backgroundColor:
      "color-mix(in srgb, var(--color-files-folder) 28%, transparent)",
  },
  "&.cm-focused": { outline: "none" },
});

/** Raw source: monospace, gutter, active-line highlight — the code view, deliberately. */
const sourceTheme = EditorView.theme({
  "&": {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-mono)",
  },
  ".cm-scroller": { lineHeight: "var(--text-mono--line-height)" },
  ".cm-content": {
    padding: "var(--spacing-4)",
    caretColor: "var(--color-files-text)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-files-editor-overlay)",
    color: "var(--color-files-text-muted)",
    borderRight: "1px solid var(--color-files-border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "var(--color-files-surface-muted)",
  },
  [SELECTION_LAYER_SELECTOR]: {
    backgroundColor:
      "color-mix(in srgb, var(--color-files-cta) 30%, transparent)",
  },
});

/**
 * Document view keeps no gutter and no active-line band: prose does not want code furniture.
 * Measure, padding, and prose type come from `.files-doc-prose` in globals.css, because the
 * decoration classes those rules cascade into never pass through Tailwind's scanner.
 */
const documentTheme = EditorView.theme({
  ".cm-scroller": { lineHeight: "var(--text-doc-body--line-height)" },
  // Must mirror CodeMirror's own baseTheme selector shape
  // (`&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`) — a plain
  // `.cm-selectionBackground` rule loses to it and its default #d7d4f0 lavender shows through.
  [SELECTION_LAYER_SELECTOR]: {
    backgroundColor: "var(--color-files-doc-selection)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-files-text)",
  },
});

type SelectionRange = { from: number; to: number };
type EditorVariant = "document" | "source";

function runMarkdownCommand(view: EditorView, command: MarkdownCommand) {
  const selection = view.state.selection.main;
  const result = applyMarkdownCommand({
    text: view.state.doc.toString(),
    from: selection.from,
    to: selection.to,
    command,
  });
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: result.text },
    selection: { anchor: result.selection.from, head: result.selection.to },
    scrollIntoView: true,
  });
  return true;
}

function continueMarkdownListCommand(view: EditorView) {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return false;
  const result = continueMarkdownList({
    text: view.state.doc.toString(),
    cursor: selection.from,
  });
  if (!result) return false;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: result.text },
    selection: { anchor: result.cursor },
    scrollIntoView: true,
  });
  return true;
}

function CodeMirrorTextEditor({
  value,
  onChange,
  markdownMode,
  variant,
  editorRef,
  onSelectionChange,
  onSaveNow,
}: {
  value: string;
  onChange: (value: string) => void;
  markdownMode: boolean;
  variant: EditorVariant;
  editorRef: React.MutableRefObject<EditorView | null>;
  onSelectionChange: (range: SelectionRange) => void;
  onSaveNow?: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const initialValue = useRef(value);
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onSaveNowRef = useRef(onSaveNow);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
    onSaveNowRef.current = onSaveNow;
  }, [onChange, onSaveNow, onSelectionChange]);

  useEffect(() => {
    if (!host.current) return;
    const isDocument = variant === "document";
    const gutterExtensions: Extension[] = isDocument
      ? []
      : [lineNumbers(), highlightActiveLine(), highlightActiveLineGutter()];

    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          history(),
          search(),
          ...gutterExtensions,
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          crosshairCursor(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          keymap.of([
            { key: "Mod-h", run: openSearchPanel },
            { key: "Mod-g", run: gotoLine },
            ...(markdownMode
              ? [
                  {
                    key: "Mod-b",
                    run: (activeView: EditorView) =>
                      runMarkdownCommand(activeView, "bold"),
                  },
                  {
                    key: "Mod-i",
                    run: (activeView: EditorView) =>
                      runMarkdownCommand(activeView, "italic"),
                  },
                  { key: "Enter", run: continueMarkdownListCommand },
                ]
              : []),
            {
              key: "Mod-s",
              run: () => {
                onSaveNowRef.current?.();
                return true;
              },
            },
            ...closeBracketsKeymap,
            indentWithTab,
            ...searchKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          baseTheme,
          isDocument ? documentTheme : sourceTheme,
          // `base` matters: bare markdown() parses CommonMark only, which has no tables, no
          // strikethrough, and no task lists — so those nodes never appear in the tree and the
          // md-table / md-strike / md-task-marker classes never fire. markdownLanguage is the
          // GFM-enabled base, which is what people actually write.
          ...(markdownMode ? [markdown({ base: markdownLanguage })] : []),
          ...(isDocument && markdownMode ? [markdownLivePreview()] : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              const main = update.state.selection.main;
              onSelectionChangeRef.current({ from: main.from, to: main.to });
            }
          }),
        ],
      }),
    });
    editorRef.current = view;
    return () => {
      editorRef.current = null;
      view.destroy();
    };
  }, [editorRef, markdownMode, variant]);

  return (
    <div
      ref={host}
      className={`h-full min-h-0 ${variant === "document" ? "files-doc-prose" : ""}`}
    />
  );
}

/** Preview styling for the split view, hoisted so it is not rebuilt on every render. */
const PREVIEW_COMPONENTS = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-4 mt-2 text-doc-h1">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-6 text-doc-h2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-5 text-doc-h3">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 text-doc-body">{children}</p>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      rel="noreferrer"
      target="_blank"
      className="md-link"
    >
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="md-code-inline">{children}</code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 list-disc space-y-1 pl-6 text-doc-body">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 text-doc-body">
      {children}
    </ol>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-files-doc-rule pl-4 text-files-text-muted">
      {children}
    </blockquote>
  ),
};

/** Keyboard selection fires per keystroke; showing the toolbar on each one flickers. */
const SELECTION_SETTLE_MS = 120;

export function TextDocumentEditor({
  value,
  onChange,
  format,
  viewMode,
  onSaveNow,
}: {
  value: string;
  onChange: (value: string) => void;
  format: "markdown" | "text";
  viewMode: MarkdownViewMode;
  onSaveNow?: () => void;
}) {
  const editorRef = useRef<EditorView | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [editorReady, setEditorReady] = useState<EditorView | null>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [remoteImagesAllowed, setRemoteImagesAllowed] = useState(false);
  const splitDrag = useRef<{ startX: number; startPercent: number } | null>(
    null,
  );
  const settleTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setEditorReady(editorRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [format, viewMode]);

  // Hide immediately when the selection empties, but let a growing selection settle first.
  const handleSelectionChange = useCallback((range: SelectionRange) => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (range.from === range.to) {
      setSelection(null);
      return;
    }
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      setSelection(range);
    }, SELECTION_SETTLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
      }
    },
    [],
  );

  const runCommand = useCallback((command: MarkdownCommand) => {
    const view = editorRef.current;
    if (!view) return;
    runMarkdownCommand(view, command);
    view.focus();
  }, []);

  if (format === "text") {
    return (
      <div className="min-h-0 flex-1 overflow-hidden bg-files-editor-solid">
        <CodeMirrorTextEditor
          value={value}
          onChange={onChange}
          markdownMode={false}
          variant="source"
          editorRef={editorRef}
          onSelectionChange={handleSelectionChange}
          onSaveNow={onSaveNow}
        />
      </div>
    );
  }

  const isSplit = viewMode === "split";
  const variant: EditorVariant = viewMode === "document" ? "document" : "source";

  return (
    <div
      ref={hostRef}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-files-editor-solid"
    >
      <section
        aria-label={
          viewMode === "document" ? "Document" : "Markdown source"
        }
        className="min-h-0 overflow-hidden"
        style={isSplit ? { width: `${splitPercent}%` } : { width: "100%" }}
      >
        <CodeMirrorTextEditor
          value={value}
          onChange={onChange}
          markdownMode
          variant={variant}
          editorRef={editorRef}
          onSelectionChange={handleSelectionChange}
          onSaveNow={onSaveNow}
        />
      </section>

      {isSplit ? (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize Markdown source and preview"
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={Math.round(splitPercent)}
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowLeft"
                ? -5
                : event.key === "ArrowRight"
                  ? 5
                  : 0;
            if (!delta) return;
            event.preventDefault();
            setSplitPercent((current) =>
              Math.max(25, Math.min(75, current + delta)),
            );
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            splitDrag.current = {
              startX: event.clientX,
              startPercent: splitPercent,
            };
          }}
          onPointerMove={(event) => {
            if (!splitDrag.current) return;
            const hostWidth =
              event.currentTarget.parentElement?.getBoundingClientRect().width ??
              1;
            const delta =
              ((event.clientX - splitDrag.current.startX) / hostWidth) * 100;
            setSplitPercent(
              Math.max(25, Math.min(75, splitDrag.current.startPercent + delta)),
            );
          }}
          onPointerUp={(event) => {
            splitDrag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          className="files-editor-resize w-1 shrink-0 cursor-col-resize touch-none bg-files-border outline-none hover:bg-files-border-strong"
        />
      ) : null}

      {isSplit ? (
        <article
          aria-label="Markdown preview"
          className="min-w-0 flex-1 overflow-auto p-5 text-files-text"
        >
          {!remoteImagesAllowed && /!\[[^\]]*\]\(https?:\/\//.test(value) ? (
            <button
              type="button"
              onClick={() => setRemoteImagesAllowed(true)}
              className="mb-4 rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-meta font-medium text-files-text outline-none hover:bg-files-surface focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
            >
              Load remote images
            </button>
          ) : null}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              ...PREVIEW_COMPONENTS,
              img: ({ alt, src }) =>
                remoteImagesAllowed && src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={alt ?? ""}
                    src={src}
                    className="my-4 max-w-full rounded-files-card border border-files-border"
                  />
                ) : (
                  <span
                    role="img"
                    aria-label={alt || "Remote image blocked"}
                    className="my-3 block rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-meta text-files-text-muted"
                  >
                    Remote image blocked for privacy
                    {alt ? `: ${alt}` : ""}
                  </span>
                ),
            }}
          >
            {value}
          </ReactMarkdown>
        </article>
      ) : null}

      <MarkdownBubbleToolbar
        view={editorReady}
        selection={selection}
        hostRef={hostRef}
        onRunCommand={runCommand}
      />
    </div>
  );
}
