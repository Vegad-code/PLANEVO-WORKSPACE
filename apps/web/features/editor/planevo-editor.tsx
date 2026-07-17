"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  beginSave,
  completeSave,
  failSave,
  INITIAL_SAVE_STATE,
  markDirty,
  type EditorSaveState,
} from "@planevo/core/state/editor-state";
import {
  planevoSchema,
  type PlanevoPartialBlock,
} from "@/features/editor/schema";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";

const SAVE_DEBOUNCE_MS = 500;

export type PlanevoEditorInstance = BlockNoteEditor<
  typeof planevoSchema.blockSchema,
  typeof planevoSchema.inlineContentSchema,
  typeof planevoSchema.styleSchema
>;

export type EditorSaveHandler = (
  content: PlanevoPartialBlock[],
) => Promise<{ ok: boolean; error?: string }>;

function parseInitialContent(content: unknown): PlanevoPartialBlock[] | undefined {
  return Array.isArray(content) && content.length > 0
    ? (content as PlanevoPartialBlock[])
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

export function PlanevoEditor({
  initialContent,
  onSave,
  toolbar,
}: {
  initialContent: unknown;
  onSave: EditorSaveHandler;
  toolbar?: (ctx: {
    editor: PlanevoEditorInstance;
    markDirtyAndSchedule: () => void;
  }) => ReactNode;
}) {
  const theme = useResolvedTheme();
  const editor = useCreateBlockNote({
    schema: planevoSchema,
    initialContent: parseInitialContent(initialContent),
  });
  const saveState = useRef<EditorSaveState>(INITIAL_SAVE_STATE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [indicator, setIndicator] = useState<"idle" | "dirty" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(async () => {
    const saving = beginSave(saveState.current);
    if (!saving) return;
    saveState.current = saving;
    setIndicator("saving");

    const result = await onSave(editor.document);
    if (result.ok) {
      setSaveError(null);
      saveState.current = completeSave(saveState.current);
      setIndicator("saved");
      if (saveState.current.status === "dirty") {
        timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
      }
    } else {
      setSaveError(result.error ?? "Failed to save.");
      saveState.current = failSave();
      setIndicator("error");
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    }
  }, [editor, onSave]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }, [flush]);

  const markDirtyAndSchedule = useCallback(() => {
    saveState.current = markDirty(saveState.current);
    setIndicator("dirty");
    scheduleSave();
  }, [scheduleSave]);

  const toolbarNode = toolbar?.({ editor, markDirtyAndSchedule });

  return (
    <div className="planevo-editor">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">{toolbarNode}</div>
        <SaveIndicator state={indicator} errorMessage={saveError} />
      </div>
      <BlockNoteView editor={editor} onChange={markDirtyAndSchedule} theme={theme} />
    </div>
  );
}
