"use client";

import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { toast } from "@/components/ui/toast";
import type { PlanevoEditorInstance } from "@/features/editor/editor-types";
import { blocksToPromotable } from "@/features/editor/promote-panel";
import type { PlanevoBlock, PlanevoPartialBlock } from "@/features/editor/schema";

type PlanevoDragHandleMenuProps = {
  pageId: string;
  onPromote: (blocks: PlanevoBlock[]) => void;
};

function useSideMenuBlock() {
  return useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  });
}

/**
 * Side-menu extras: Duplicate, Delete, Turn into, Copy link, Turn into record.
 */
export function PlanevoDragHandleMenu({
  pageId,
  onPromote,
}: PlanevoDragHandleMenuProps) {
  const editor = useBlockNoteEditor() as PlanevoEditorInstance;
  const Components = useComponentsContext();
  const block = useSideMenuBlock();

  if (!Components || !block) {
    return (
      <DragHandleMenu>
        <RemoveBlockItem>Delete</RemoveBlockItem>
        <BlockColorsItem>Colors</BlockColorsItem>
      </DragHandleMenu>
    );
  }

  const typedBlock = block as PlanevoBlock;
  const canPromote = blocksToPromotable([typedBlock]).length > 0;

  return (
    <DragHandleMenu>
      <Components.Generic.Menu.Item
        className="bn-menu-item"
        onClick={() => {
          // Reconstruct without id — cast through unknown so the block-type union stays intact.
          const duplicate = {
            type: typedBlock.type,
            props: typedBlock.props,
            content: typedBlock.content,
            children: typedBlock.children,
          } as unknown as PlanevoPartialBlock;
          editor.insertBlocks([duplicate], typedBlock, "after");
        }}
      >
        Duplicate
      </Components.Generic.Menu.Item>

      <RemoveBlockItem>Delete</RemoveBlockItem>

      <Components.Generic.Menu.Item
        className="bn-menu-item"
        onClick={() => {
          // Lightweight "turn into": cycle list → paragraph.
          if (
            typedBlock.type === "bulletListItem" ||
            typedBlock.type === "numberedListItem" ||
            typedBlock.type === "checkListItem"
          ) {
            editor.updateBlock(typedBlock, { type: "paragraph" });
            return;
          }
          if (typedBlock.type === "paragraph") {
            editor.updateBlock(typedBlock, { type: "bulletListItem" });
          }
        }}
      >
        Turn into
      </Components.Generic.Menu.Item>

      <Components.Generic.Menu.Item
        className="bn-menu-item"
        onClick={async () => {
          const href = `${window.location.origin}/pages/${pageId}#${typedBlock.id}`;
          try {
            await navigator.clipboard.writeText(href);
            toast("Link to block copied");
          } catch {
            toast("Could not copy link", { tone: "error" });
          }
        }}
      >
        Copy link to block
      </Components.Generic.Menu.Item>

      {canPromote && (
        <Components.Generic.Menu.Item
          className="bn-menu-item"
          onClick={() => onPromote([typedBlock])}
        >
          Turn into record
        </Components.Generic.Menu.Item>
      )}

      <BlockColorsItem>Colors</BlockColorsItem>
    </DragHandleMenu>
  );
}
