"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanevoEditorInstance } from "@/features/editor/planevo-editor";
import type { PlanevoBlock } from "@/features/editor/schema";
import {
  promoteBlocksToRecords,
  savePageContent,
} from "@/app/(workspace)/pages/[pageId]/actions";
import { flattenRecordsToLines } from "@/app/(workspace)/pages/[pageId]/flatten-actions";
import { OnboardingChecklistAnalytics } from "@/features/editor/onboarding-checklist-analytics";
import { PlanevoEditor } from "@/features/editor/planevo-editor";
import { PromotePanel } from "@/features/editor/promote-panel";
import {
  FLATTEN_DATABASE_VIEW_EVENT,
  type FlattenDatabaseViewDetail,
} from "@/features/editor/embedded-database-view";

export function PageEditor({
  pageId,
  initialContent,
  databaseOptions,
  calendarViewOptions,
  trackOnboardingChecklist = false,
}: {
  pageId: string;
  initialContent: unknown;
  databaseOptions: { id: string; name: string }[];
  calendarViewOptions: { id: string; name: string }[];
  trackOnboardingChecklist?: boolean;
}) {
  const editorRef = useRef<PlanevoEditorInstance | null>(null);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const [promoteBlocks, setPromoteBlocks] = useState<PlanevoBlock[] | null>(null);
  const [promoteNotice, setPromoteNotice] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [analyticsContent, setAnalyticsContent] = useState(initialContent);

  useEffect(() => {
    async function onFlatten(event: Event) {
      const detail = (event as CustomEvent<FlattenDatabaseViewDetail>).detail;
      const editor = editorRef.current;
      const markDirtyAndSchedule = markDirtyRef.current;
      if (!detail?.databaseId || !detail.recordIds || !editor || !markDirtyAndSchedule) {
        return;
      }

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

      editor.replaceBlocks([databaseViewBlock], bulletBlocks);
      markDirtyAndSchedule();
      setPromoteNotice(
        `Restored ${result.lines.length} line${result.lines.length === 1 ? "" : "s"} as bullets.`,
      );
    }

    window.addEventListener(FLATTEN_DATABASE_VIEW_EVENT, onFlatten);
    return () => window.removeEventListener(FLATTEN_DATABASE_VIEW_EVENT, onFlatten);
  }, []);

  async function confirmPromote(input: {
    databaseId: string;
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
    const editor = editorRef.current;
    if (!editor) return;

    setPromoting(true);
    try {
      const result = await promoteBlocksToRecords({
        pageId,
        databaseId: input.databaseId,
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

      // Server already patched content_json atomically — sync the live editor only.
      editor.replaceBlocks(
        input.drafts.map((entry) => entry.block),
        [
          {
            type: "database_view",
            props: {
              databaseId: result.databaseId,
              viewId: "",
              filterKey: "",
              recordIds: result.recordIds.join(","),
            },
          },
        ],
      );
      setPromoteBlocks(null);
      setPromoteNotice(
        `Created ${result.recordIds.length} record${result.recordIds.length === 1 ? "" : "s"} and linked them here.`,
      );
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <OnboardingChecklistAnalytics
        enabled={trackOnboardingChecklist}
        content={analyticsContent}
      />
      {promoteNotice && (
        <p role="status" className="text-small text-text-secondary">
          {promoteNotice}
        </p>
      )}
      <PlanevoEditor
        pageId={pageId}
        initialContent={initialContent}
        databaseOptions={databaseOptions}
        calendarViewOptions={calendarViewOptions}
        onSave={async (content) => {
          if (trackOnboardingChecklist) setAnalyticsContent(content);
          return savePageContent(pageId, content);
        }}
        onPromoteRequest={(blocks) => {
          setPromoteBlocks(blocks);
          setPromoteNotice(null);
        }}
        toolbar={({ editor, markDirtyAndSchedule }) => {
          editorRef.current = editor;
          markDirtyRef.current = markDirtyAndSchedule;
          return null;
        }}
      />
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
