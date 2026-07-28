"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Braces,
  CheckSquare,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import {
  activeMarkdownMarks,
  type MarkdownCommand,
} from "@/lib/files/markdown-commands";
import { placeBubble, type BubblePlacement } from "@/lib/files/bubble-position";

/**
 * The one formatting surface in the document view. It exists only while text is selected — there
 * is deliberately no persistent toolbar, so two of these can never be on screen at once.
 *
 * Groups are separated by dividers rather than labels, in the order the reference uses:
 * headings, inline emphasis, links and code, quote, lists.
 */
type ToolbarEntry =
  | { kind: "divider"; id: string }
  | {
      kind: "command";
      command: MarkdownCommand;
      label: string;
      icon: React.ReactNode;
    };

const ENTRIES: ToolbarEntry[] = [
  { kind: "command", command: "heading-1", label: "Heading 1", icon: "H1" },
  { kind: "command", command: "heading-2", label: "Heading 2", icon: "H2" },
  { kind: "divider", id: "after-headings" },
  {
    kind: "command",
    command: "bold",
    label: "Bold",
    icon: <Bold aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "italic",
    label: "Italic",
    icon: <Italic aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "strikethrough",
    label: "Strikethrough",
    icon: <Strikethrough aria-hidden="true" className="size-4" />,
  },
  { kind: "divider", id: "after-emphasis" },
  {
    kind: "command",
    command: "link",
    label: "Link",
    icon: <Link2 aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "inline-code",
    label: "Inline code",
    icon: <Code2 aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "code-block",
    label: "Code block",
    icon: <Braces aria-hidden="true" className="size-4" />,
  },
  { kind: "divider", id: "after-code" },
  {
    kind: "command",
    command: "quote",
    label: "Quote",
    icon: <Quote aria-hidden="true" className="size-4" />,
  },
  { kind: "divider", id: "after-quote" },
  {
    kind: "command",
    command: "bullet-list",
    label: "Bulleted list",
    icon: <List aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "numbered-list",
    label: "Numbered list",
    icon: <ListOrdered aria-hidden="true" className="size-4" />,
  },
  {
    kind: "command",
    command: "check-list",
    label: "Checklist",
    icon: <CheckSquare aria-hidden="true" className="size-4" />,
  },
];

export function MarkdownBubbleToolbar({
  view,
  selection,
  hostRef,
  onRunCommand,
}: {
  view: EditorView | null;
  /** `null` while the selection is empty, which is also what hides the toolbar. */
  selection: { from: number; to: number } | null;
  hostRef: React.RefObject<HTMLElement | null>;
  onRunCommand: (command: MarkdownCommand) => void;
}) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<BubblePlacement | null>(null);
  // Escape records *which* selection was dismissed rather than a bare boolean, so a fresh
  // selection re-arms the toolbar on its own — no effect needed to reset it.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const selectionKey = selection ? `${selection.from}:${selection.to}` : null;
  const dismissed = selectionKey !== null && dismissedKey === selectionKey;

  const reposition = useCallback(() => {
    const host = hostRef.current;
    const toolbar = toolbarRef.current;
    if (!view || !selection || !host || !toolbar) {
      setPlacement(null);
      return;
    }
    const start = view.coordsAtPos(selection.from);
    const end = view.coordsAtPos(selection.to);
    if (!start || !end) {
      // CodeMirror returns null for positions scrolled out of the rendered viewport.
      setPlacement(null);
      return;
    }
    const hostRect = host.getBoundingClientRect();
    setPlacement(
      placeBubble({
        selectionLeft: Math.min(start.left, end.left) - hostRect.left,
        selectionRight: Math.max(start.right, end.right) - hostRect.left,
        selectionTop: Math.min(start.top, end.top) - hostRect.top,
        selectionBottom: Math.max(start.bottom, end.bottom) - hostRect.top,
        toolbarWidth: toolbar.offsetWidth,
        toolbarHeight: toolbar.offsetHeight,
        containerWidth: hostRect.width,
        containerHeight: hostRect.height,
      }),
    );
  }, [hostRef, selection, view]);

  // Measure-then-place is the legitimate use of useLayoutEffect: the position depends on the
  // toolbar's own rendered width, so it cannot be derived during render. Running it after paint
  // instead would show the toolbar at (0,0) for a frame — the exact jitter this replaces.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM measurement, not derived state
  useLayoutEffect(reposition, [reposition]);

  useEffect(() => {
    if (!selection || dismissed) return;
    const scroller = view?.scrollDOM;
    // Scroll fires far faster than we can usefully re-render. Coalescing to one reposition per
    // animation frame keeps a selected document from juddering while the user scrolls it.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        reposition();
      });
    };
    window.addEventListener("resize", onScroll);
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onScroll);
      scroller?.removeEventListener("scroll", onScroll);
    };
  }, [dismissed, reposition, selection, view]);

  useEffect(() => {
    if (!selection || dismissed) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || selectionKey === null) return;
      setDismissedKey(selectionKey);
      view?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissed, selection, selectionKey, view]);

  if (!selection || dismissed) return null;

  const active = view
    ? activeMarkdownMarks({
        text: view.state.doc.toString(),
        from: selection.from,
        to: selection.to,
      })
    : new Set<MarkdownCommand>();

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Format selection"
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        // Hidden rather than unmounted until measured, so offsetWidth is readable on first pass.
        visibility: placement ? "visible" : "hidden",
      }}
      // Utilities rather than a semantic class: the surrounding chrome is styled this way, and
      // the tokens below resolve per theme through globals.css.
      className="absolute z-30 flex items-center gap-0.5 rounded-[10px] border border-files-bubble-border bg-files-bubble-bg p-1 shadow-md"
    >
      {ENTRIES.map((entry) =>
        entry.kind === "divider" ? (
          <span
            key={entry.id}
            aria-hidden="true"
            className="mx-1 h-[18px] w-px shrink-0 bg-files-bubble-border"
          />
        ) : (
          <button
            key={entry.command}
            type="button"
            title={entry.label}
            aria-label={entry.label}
            aria-pressed={active.has(entry.command)}
            // Keeps the document selection alive through the click, so the command has a range.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onRunCommand(entry.command)}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-files-bubble-icon outline-none transition-colors hover:bg-files-bubble-hover hover:text-files-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-files-editor-focus aria-pressed:bg-files-bubble-active aria-pressed:text-files-text motion-reduce:transition-none"
          >
            {entry.icon}
          </button>
        ),
      )}
    </div>
  );
}
