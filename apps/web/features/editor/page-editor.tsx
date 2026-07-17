"use client";

import { useEffect, useState } from "react";
import type { PlanevoEditorInstance } from "@/features/editor/planevo-editor";
import type { PlanevoBlock } from "@/features/editor/schema";
import {
  promoteBlocksToRecords,
  savePageContent,
} from "@/app/(workspace)/pages/[pageId]/actions";
import { flattenRecordsToLines } from "@/app/(workspace)/pages/[pageId]/flatten-actions";
import { PlanevoEditor } from "@/features/editor/planevo-editor";
import { PromotePanel } from "@/features/editor/promote-panel";
import {
  FLATTEN_DATABASE_VIEW_EVENT,
  type FlattenDatabaseViewDetail,
} from "@/features/editor/embedded-database-view";

function PageEditorToolbar({
  pageId,
  databaseOptions,
  editor,
  markDirtyAndSchedule,
}: {
  pageId: string;
  databaseOptions: { id: string; name: string }[];
  editor: PlanevoEditorInstance;
  markDirtyAndSchedule: () => void;
}) {
  const [promoteBlocks, setPromoteBlocks] = useState<PlanevoBlock[] | null>(null);
  const [promoteNotice, setPromoteNotice] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    async function onFlatten(event: Event) {
      const detail = (event as CustomEvent<FlattenDatabaseViewDetail>).detail;
      if (!detail?.databaseId || !detail.recordIds) return;

      const recordIds = detail.recordIds.split(",").map((id) => id.trim()).filter(Boolean);
      const result = await flattenRecordsToLines({
        databaseId: detail.databaseId,
        recordIds,
      });
      if (!result.ok || !result.lines?.length) {
        setPromoteNotice(result.error ?? "Nothing to flatten.");
        return;
      }

      const databaseViewBlock = editor.document.find(
        (block) =>
          block.type === "database_view" &&
          block.props.databaseId === detail.databaseId &&
          block.props.recordIds === detail.recordIds,
      );
      if (!databaseViewBlock) {
        setPromoteNotice("Could not find the linked view in this page.");
        return;
      }

      const bulletBlocks = result.lines.map((line) => ({
        type: "bulletListItem" as const,
        content: [{ type: "text" as const, text: line, styles: {} }],
      }));

      if (typeof editor.replaceBlocks === "function") {
        editor.replaceBlocks([databaseViewBlock], bulletBlocks);
      } else {
        editor.insertBlocks(bulletBlocks, databaseViewBlock, "before");
        editor.removeBlocks([databaseViewBlock]);
      }

      markDirtyAndSchedule();
      setPromoteNotice(
        `Restored ${result.lines.length} line${result.lines.length === 1 ? "" : "s"} as bullets.`,
      );
    }

    window.addEventListener(FLATTEN_DATABASE_VIEW_EVENT, onFlatten);
    return () => window.removeEventListener(FLATTEN_DATABASE_VIEW_EVENT, onFlatten);
  }, [editor, markDirtyAndSchedule]);

  function openPromotePanel() {
    const selection = editor.getSelection();
    const candidates = (selection?.blocks ?? [editor.getTextCursorPosition().block]) as PlanevoBlock[];
    setPromoteBlocks(candidates);
    setPromoteNotice(null);
  }

  async function confirmPromote(input: {
    databaseId: string;
    createNewTaskDatabase?: boolean;
    drafts: Array<{
      block: PlanevoBlock;
      draft: {
        title: string;
        dueDate: string | null;
        priority: string | null;
        status: string | null;
      };
    }>;
  }) {
    setPromoting(true);
    try {
      const result = await promoteBlocksToRecords({
        pageId,
        databaseId: input.databaseId,
        createNewTaskDatabase: input.createNewTaskDatabase,
        blocks: input.drafts.map((entry) => ({
          blockId: entry.block.id,
          title: entry.draft.title,
          dueDate: entry.draft.dueDate,
          priority: entry.draft.priority,
          status: entry.draft.status,
        })),
      });

      if (!result.ok || !result.databaseId || !result.recordIds?.length) {
        setPromoteNotice(result.error ?? "Failed to create records.");
        return;
      }

      const blocksToReplace = input.drafts.map((entry) => entry.block);
      const databaseViewBlock = {
        type: "database_view" as const,
        props: {
          databaseId: result.databaseId,
          viewId: "",
          filterKey: "",
          recordIds: result.recordIds.join(","),
        },
      };

      if (typeof editor.replaceBlocks === "function") {
        editor.replaceBlocks(blocksToReplace, [databaseViewBlock]);
      } else {
        const anchor = blocksToReplace[0]!;
        editor.insertBlocks([databaseViewBlock], anchor, "before");
        editor.removeBlocks(blocksToReplace);
      }

      markDirtyAndSchedule();
      setPromoteBlocks(null);
      setPromoteNotice(
        `Created ${result.recordIds.length} record${result.recordIds.length === 1 ? "" : "s"} and linked them here.`,
      );
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={promoting || databaseOptions.length === 0}
          onClick={openPromotePanel}
          className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          title="Turn selected bullet or checklist items into records"
        >
          Turn into records
        </button>
        {promoteNotice && (
          <p role="status" className="text-small text-text-secondary">
            {promoteNotice}
          </p>
        )}
      </div>
      {promoteBlocks && (
        <PromotePanel
          blocks={promoteBlocks}
          databaseOptions={databaseOptions}
          promoting={promoting}
          onCancel={() => setPromoteBlocks(null)}
          onConfirm={confirmPromote}
        />
      )}
    </div>
  );
}

export function PageEditor({
  pageId,
  initialContent,
  databaseOptions,
}: {
  pageId: string;
  initialContent: unknown;
  databaseOptions: { id: string; name: string }[];
}) {
  return (
    <PlanevoEditor
      initialContent={initialContent}
      onSave={(content) => savePageContent(pageId, content)}
      toolbar={({ editor, markDirtyAndSchedule }) => (
        <PageEditorToolbar
          pageId={pageId}
          databaseOptions={databaseOptions}
          editor={editor}
          markDirtyAndSchedule={markDirtyAndSchedule}
        />
      )}
    />
  );
}
