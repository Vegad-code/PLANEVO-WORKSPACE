"use client";

import {
  useBlockNoteEditor,
  useComponentsContext,
  useEditorState,
} from "@blocknote/react";
import { blocksToPromotable } from "@/features/editor/promote-panel";
import type { PlanevoBlock } from "@/features/editor/schema";

type TurnIntoRecordsButtonProps = {
  onOpen: (blocks: PlanevoBlock[]) => void;
};

/**
 * Formatting-toolbar control — selection-sensitive. Opens the promote panel.
 */
export function TurnIntoRecordsButton({ onOpen }: TurnIntoRecordsButtonProps) {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  const canPromote = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const selection = current.getSelection();
      const candidates = (selection?.blocks ?? [
        current.getTextCursorPosition().block,
      ]) as PlanevoBlock[];
      return blocksToPromotable(candidates).length > 0;
    },
  });

  if (!Components) return null;

  return (
    <Components.FormattingToolbar.Button
      mainTooltip="Turn into records"
      label="Turn into records"
      isDisabled={!canPromote}
      onClick={() => {
        const selection = editor.getSelection();
        const candidates = (selection?.blocks ?? [
          editor.getTextCursorPosition().block,
        ]) as PlanevoBlock[];
        onOpen(candidates);
      }}
    />
  );
}
