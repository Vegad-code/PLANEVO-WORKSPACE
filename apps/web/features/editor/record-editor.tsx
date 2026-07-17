"use client";

import { PlanevoEditor } from "@/features/editor/planevo-editor";
import { saveRecordContent } from "@/app/(workspace)/records/[recordId]/actions";

export function RecordEditor({
  recordId,
  initialContent,
}: {
  recordId: string;
  initialContent: unknown;
}) {
  return (
    <PlanevoEditor
      initialContent={initialContent}
      onSave={(content) => saveRecordContent(recordId, content)}
    />
  );
}
