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
import { savePageContent } from "@/app/(workspace)/pages/[pageId]/actions";

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

  return (
    <div className="planevo-editor">
      {saveError && (
        <p role="alert" className="mb-3 rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
          {saveError} Retrying…
        </p>
      )}
      <BlockNoteView editor={editor} onChange={handleChange} theme={theme} />
    </div>
  );
}
