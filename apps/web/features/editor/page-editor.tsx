"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import {
  beginSave,
  completeSave,
  failSave,
  INITIAL_SAVE_STATE,
  markDirty,
  type EditorSaveState,
} from "@planevo/core/state/editor-state";
import {
  promoteItemsToTasks,
  savePageContent,
} from "@/app/(workspace)/pages/[pageId]/actions";

const LIST_BLOCK_TYPES = new Set(["bulletListItem", "checkListItem", "numberedListItem"]);

function blockText(block: Block): string {
  if (!Array.isArray(block.content)) return "";
  return block.content
    .map((inline) => {
      if (typeof inline !== "object" || inline === null) return "";
      if ("text" in inline && typeof inline.text === "string") return inline.text;
      return "";
    })
    .join("");
}

const SAVE_DEBOUNCE_MS = 800;

function parseInitialContent(content: unknown): Block[] | undefined {
  return Array.isArray(content) && content.length > 0
    ? (content as Block[])
    : undefined;
}

/** Follows the data-theme attribute the appearance settings write to <html>. */
function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function PageEditor({
  pageId,
  initialContent,
}: {
  pageId: string;
  initialContent: unknown;
}) {
  const theme = useResolvedTheme();
  const editor = useCreateBlockNote({
    initialContent: parseInitialContent(initialContent),
  });
  const saveState = useRef<EditorSaveState>(INITIAL_SAVE_STATE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [promoteNotice, setPromoteNotice] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function flush() {
    const saving = beginSave(saveState.current);
    if (!saving) return;
    saveState.current = saving;
    const result = await savePageContent(pageId, editor.document);
    if (result.ok) {
      setSaveError(null);
      saveState.current = completeSave(saveState.current);
      // Edits arrived while saving — run the queued follow-up save.
      if (saveState.current.status === "dirty") scheduleSave();
    } else {
      setSaveError(result.error ?? "Failed to save the page.");
      saveState.current = failSave();
      scheduleSave();
    }
  }

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  function handleChange() {
    saveState.current = markDirty(saveState.current);
    scheduleSave();
  }

  // Retroactive structure v1: selected list items become task records, and
  // the promoted blocks leave the page (structure replaces the raw text).
  async function promoteSelection() {
    const selection = editor.getSelection();
    const candidates = (selection?.blocks ?? [editor.getTextCursorPosition().block]).filter(
      (block) => LIST_BLOCK_TYPES.has(block.type) && blockText(block).trim(),
    );
    if (candidates.length === 0) {
      setPromoteNotice("Select bullet or checklist items first.");
      return;
    }

    setPromoting(true);
    try {
      const result = await promoteItemsToTasks(
        pageId,
        candidates.map((block) => blockText(block)),
      );
      if (result.ok) {
        editor.removeBlocks(candidates);
        saveState.current = markDirty(saveState.current);
        scheduleSave();
        setPromoteNotice(
          `Moved ${result.created} item${result.created === 1 ? "" : "s"} to Tasks.`,
        );
      } else {
        setPromoteNotice(result.error ?? "Failed to create tasks.");
      }
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="planevo-editor">
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          disabled={promoting}
          onClick={() => void promoteSelection()}
          className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          title="Turn selected bullet or checklist items into tasks"
        >
          {promoting ? "Creating tasks…" : "Turn into tasks"}
        </button>
        {promoteNotice && (
          <p role="status" className="text-small text-text-secondary">
            {promoteNotice}
          </p>
        )}
      </div>
      {saveError && (
        <p role="alert" className="mb-3 rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
          {saveError} Retrying…
        </p>
      )}
      <BlockNoteView editor={editor} onChange={handleChange} theme={theme} />
    </div>
  );
}
