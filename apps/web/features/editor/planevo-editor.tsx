"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { en } from "@blocknote/core/locales";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  beginSave,
  completeSave,
  failSave,
  INITIAL_SAVE_STATE,
  markDirty,
  type EditorSaveState,
} from "@planevo/core/state/editor-state";
import { fuzzyMatch } from "@planevo/core/search/fuzzy";
import { fetchCommandIndex } from "@/features/command-bar/command-index-cache";
import { PlanevoDragHandleMenu } from "@/features/editor/drag-handle-menu";
import type { PlanevoEditorInstance } from "@/features/editor/editor-types";
import {
  planevoSchema,
  type PlanevoBlock,
  type PlanevoPartialBlock,
} from "@/features/editor/schema";
import {
  filterPlanevoSlashItems,
  getPlanevoSlashMenuItems,
  type DatabaseOption,
} from "@/features/editor/slash-menu-items";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import { TurnIntoRecordsButton } from "@/features/editor/turn-into-records-button";
import { resolvePageAssetUrl, uploadPageAsset } from "@/features/editor/upload-file";

const SAVE_DEBOUNCE_MS = 500;

export type { PlanevoEditorInstance } from "@/features/editor/editor-types";

export type EditorSaveHandler = (
  content: PlanevoPartialBlock[],
) => Promise<{ ok: boolean; error?: string }>;

type MentionIndexItem = {
  id: string;
  title: string;
  type: "page" | "record" | "database";
};

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

async function fetchMentionIndex(): Promise<MentionIndexItem[]> {
  // Shares the Cmd+K index (one fetch, two features). Mentions surface pages + records.
  try {
    const entries = await fetchCommandIndex();
    return entries
      .filter((entry) => entry.kind === "page" || entry.kind === "record")
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        type: entry.kind,
      }));
  } catch {
    return [];
  }
}

function mentionItems(
  editor: PlanevoEditorInstance,
  items: MentionIndexItem[],
  query: string,
): DefaultReactSuggestionItem[] {
  const scored = items
    .map((item) => {
      const match = fuzzyMatch(query, item.title);
      return match ? { item, score: match.score } : query.trim() === "" ? { item, score: 0 } : null;
    })
    .filter((entry): entry is { item: MentionIndexItem; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return scored.map(({ item }) => ({
    title: item.title,
    subtext: item.type,
    group: "Mentions",
    onItemClick: () => {
      editor.insertInlineContent([
        {
          type: "mention",
          props: {
            targetId: item.id,
            targetType: item.type,
            label: item.title,
          },
        },
        " ",
      ]);
    },
  }));
}

export function PlanevoEditor({
  initialContent,
  onSave,
  pageId,
  databaseOptions = [],
  onPromoteRequest,
  toolbar,
}: {
  initialContent: unknown;
  onSave: EditorSaveHandler;
  pageId?: string;
  databaseOptions?: DatabaseOption[];
  onPromoteRequest?: (blocks: PlanevoBlock[]) => void;
  toolbar?: (ctx: {
    editor: PlanevoEditorInstance;
    markDirtyAndSchedule: () => void;
  }) => ReactNode;
}) {
  const theme = useResolvedTheme();
  const dictionary = useMemo(
    () => ({
      ...en,
      placeholders: {
        ...en.placeholders,
        default: "Type '/' for commands",
      },
    }),
    [],
  );

  const editor = useCreateBlockNote({
    schema: planevoSchema,
    initialContent: parseInitialContent(initialContent),
    dictionary,
    uploadFile: uploadPageAsset,
    resolveFileUrl: resolvePageAssetUrl,
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

  // F-16 passive autolink stub — full title-match + Tab-to-accept lands with WS-E index.
  useEffect(() => {
    // TODO(F-16): debounce title match against command-index; underline candidates; Tab accepts.
  }, [editor]);

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

  const DragHandleMenu = useMemo(() => {
    if (!pageId || !onPromoteRequest) return undefined;
    function Menu() {
      return (
        <PlanevoDragHandleMenu pageId={pageId!} onPromote={onPromoteRequest!} />
      );
    }
    return Menu;
  }, [pageId, onPromoteRequest]);

  return (
    <div className="planevo-editor">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">{toolbarNode}</div>
        <SaveIndicator state={indicator} errorMessage={saveError} />
      </div>
      <BlockNoteView
        editor={editor}
        onChange={markDirtyAndSchedule}
        theme={theme}
        slashMenu={false}
        formattingToolbar={false}
        sideMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            if (!pageId) {
              return filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query);
            }
            const items = getPlanevoSlashMenuItems(editor, {
              pageId,
              databaseOptions,
              onNavigate: (href) => {
                // Persist the new page link before leaving so autosave isn't raced.
                void (async () => {
                  await onSave(editor.document);
                  window.location.assign(href);
                })();
              },
            });
            return filterPlanevoSlashItems(query, items);
          }}
        />

        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) => {
            const index = await fetchMentionIndex();
            return mentionItems(editor, index, query);
          }}
        />

        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              {getFormattingToolbarItems()}
              {onPromoteRequest ? (
                <TurnIntoRecordsButton onOpen={onPromoteRequest} />
              ) : null}
            </FormattingToolbar>
          )}
        />

        <SideMenuController
          sideMenu={(props) => (
            <SideMenu {...props} dragHandleMenu={DragHandleMenu} />
          )}
        />
      </BlockNoteView>
    </div>
  );
}
