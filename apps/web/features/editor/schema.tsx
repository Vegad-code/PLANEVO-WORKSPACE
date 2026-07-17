import { BlockNoteSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { EmbeddedDatabaseView } from "@/features/editor/embedded-database-view";

/**
 * Inline database views (F-05 / F-10). Renders a linked record list inside the page body.
 */
const createDatabaseView = createReactBlockSpec(
  {
    type: "database_view",
    content: "none",
    propSchema: {
      databaseId: { default: "" },
      viewId: { default: "" },
      filterKey: { default: "" },
      recordIds: { default: "" },
    },
  },
  {
    meta: {
      selectable: false,
      isolating: true,
    },
    render: ({ block }) => (
      <EmbeddedDatabaseView
        databaseId={block.props.databaseId}
        recordIds={block.props.recordIds}
      />
    ),
  },
);

export const planevoSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    database_view: createDatabaseView(),
  },
});

export type PlanevoBlock = typeof planevoSchema.Block;
export type PlanevoPartialBlock = typeof planevoSchema.PartialBlock;
