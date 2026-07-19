import type { BlockNoteEditor } from "@blocknote/core";
import type { planevoSchema } from "@/features/editor/schema";

export type PlanevoEditorInstance = BlockNoteEditor<
  typeof planevoSchema.blockSchema,
  typeof planevoSchema.inlineContentSchema,
  typeof planevoSchema.styleSchema
>;
