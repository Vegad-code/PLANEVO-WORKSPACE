"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const planevoEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-files-surface)",
    color: "var(--color-files-text)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-mono)",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "var(--text-mono--line-height)",
  },
  ".cm-content": {
    padding: "var(--spacing-4)",
    caretColor: "var(--color-files-text)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-files-surface-muted)",
    color: "var(--color-files-text-muted)",
    borderRight: "1px solid var(--color-files-border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "var(--color-files-surface-muted)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in srgb, var(--color-files-cta) 18%, transparent)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

function CodeMirrorTextEditor({
  value,
  onChange,
  markdownMode,
}: {
  value: string;
  onChange: (value: string) => void;
  markdownMode: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const initialValue = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          planevoEditorTheme,
          ...(markdownMode ? [markdown()] : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    return () => view.destroy();
  }, [markdownMode]);

  return <div ref={host} className="h-full min-h-0" />;
}

export function TextDocumentEditor({
  value,
  onChange,
  format,
}: {
  value: string;
  onChange: (value: string) => void;
  format: "markdown" | "text";
}) {
  if (format === "text") {
    return (
      <div className="min-h-0 flex-1 overflow-hidden rounded-files-card border border-files-border bg-files-surface">
        <CodeMirrorTextEditor
          value={value}
          onChange={onChange}
          markdownMode={false}
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 overflow-hidden rounded-files-card border border-files-border bg-files-surface lg:grid-cols-2">
      <section
        aria-label="Markdown source"
        className="min-h-64 overflow-hidden border-b border-files-border lg:min-h-0 lg:border-b-0 lg:border-r"
      >
        <CodeMirrorTextEditor value={value} onChange={onChange} markdownMode />
      </section>
      <article
        aria-label="Markdown preview"
        className="max-w-none overflow-auto p-4 text-files-text"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 mt-2 text-h1 font-semibold">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-3 mt-6 text-h2 font-semibold">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-5 text-h3 font-semibold">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="my-3 text-body leading-relaxed">{children}</p>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                rel="noreferrer"
                target="_blank"
                className="text-files-cta underline underline-offset-2"
              >
                {children}
              </a>
            ),
            img: ({ alt }) => (
              <span
                role="img"
                aria-label={alt || "Remote image blocked"}
                className="my-3 block rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-meta text-files-text-muted"
              >
                Remote image blocked for privacy
                {alt ? `: ${alt}` : ""}
              </span>
            ),
            code: ({ children }) => (
              <code className="rounded bg-files-surface-muted px-1 py-0.5 font-mono text-mono">
                {children}
              </code>
            ),
            ul: ({ children }) => (
              <ul className="my-3 list-disc space-y-1 pl-6 text-body">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 list-decimal space-y-1 pl-6 text-body">
                {children}
              </ol>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-l-2 border-files-border-strong pl-4 text-files-text-muted">
                {children}
              </blockquote>
            ),
          }}
        >
          {value}
        </ReactMarkdown>
      </article>
    </div>
  );
}
