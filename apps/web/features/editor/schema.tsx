import { BlockNoteSchema } from "@blocknote/core";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import { EmbeddedCalendarView } from "@/features/editor/embedded-calendar-view";
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
      defining: true,
    },
    render: ({ block }) => (
      <EmbeddedDatabaseView
        databaseId={block.props.databaseId}
        viewId={block.props.viewId}
        recordIds={block.props.recordIds}
      />
    ),
    toExternalHTML: ({ block }) => (
      <div
        data-database-view=""
        data-database-id={block.props.databaseId}
        data-view-id={block.props.viewId}
        data-filter-key={block.props.filterKey}
        data-record-ids={block.props.recordIds}
      >
        Database view
      </div>
    ),
  },
);

/**
 * Saved calendar lens. `viewId` is the only data identity; height is a
 * presentation preference and the renderer always reloads the current view.
 */
const createCalendarEmbed = createReactBlockSpec(
  {
    type: "calendar_embed",
    content: "none",
    propSchema: {
      viewId: { default: "" },
      height: { default: "standard" },
    },
  },
  {
    meta: {
      selectable: false,
      isolating: true,
      defining: true,
    },
    render: ({ block }) => (
      <EmbeddedCalendarView
        viewId={block.props.viewId}
        height={block.props.height}
      />
    ),
    toExternalHTML: ({ block }) => (
      <div
        data-calendar-embed=""
        data-view-id={block.props.viewId}
        data-height={block.props.height}
      >
        Calendar view
      </div>
    ),
  },
);

/**
 * F-16 mention chip. Props carry the linked entity; content is the display label.
 */
const mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      targetId: { default: "" },
      targetType: { default: "page" },
      label: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <span
        className="rounded-md bg-sidebar px-1 py-0.5 text-ink"
        data-mention-id={inlineContent.props.targetId}
        data-mention-type={inlineContent.props.targetType}
      >
        @{inlineContent.props.label || "mention"}
      </span>
    ),
  },
);

export const planevoSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    database_view: createDatabaseView(),
    calendar_embed: createCalendarEmbed(),
  },
  inlineContentSpecs: {
    mention: mention,
  },
});

export type PlanevoBlock = typeof planevoSchema.Block;
export type PlanevoPartialBlock = typeof planevoSchema.PartialBlock;
