"use client";

import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import {
  CalendarDaysIcon,
  DocumentPlusIcon,
  RectangleStackIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { fuzzyMatch } from "@planevo/core/search/fuzzy";
import {
  createDatabaseFromTemplateAction,
  createSubpage,
} from "@/app/(workspace)/pages/[pageId]/actions";
import type { PlanevoEditorInstance } from "@/features/editor/editor-types";

export type DatabaseOption = { id: string; name: string };
export type CalendarViewOption = { id: string; name: string };

type Editor = PlanevoEditorInstance;

const TEMPLATE_CHOICES = [
  { type: "task" as const, title: "Tasks", aliases: ["todo", "checklist"] },
  { type: "notes" as const, title: "Notes", aliases: ["journal"] },
  { type: "project" as const, title: "Projects", aliases: ["roadmap"] },
  { type: "files" as const, title: "Files", aliases: ["attachments"] },
  { type: "custom" as const, title: "Empty database", aliases: ["blank", "custom"] },
];

function insertDatabaseView(editor: Editor, databaseId: string) {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: "database_view",
    props: {
      databaseId,
      viewId: "",
      filterKey: "",
      recordIds: "",
    },
  });
}

function insertCalendarEmbed(editor: Editor, viewId: string) {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: "calendar_embed",
    props: {
      viewId,
      height: "standard",
    },
  });
}

function insertPageLink(editor: Editor, pageId: string, title: string) {
  insertOrUpdateBlockForSlashMenu(editor, {
    type: "paragraph",
    content: [
      {
        type: "link",
        href: `/pages/${pageId}`,
        content: [{ type: "text", text: title, styles: {} }],
      },
    ],
  });
}

/**
 * Defaults + Planevo items (Page, Database template, Embed existing database).
 * Embed items are filtered client-side with the shared fuzzy scorer.
 */
export function getPlanevoSlashMenuItems(
  editor: Editor,
  options: {
    pageId: string;
    databaseOptions: DatabaseOption[];
    calendarViewOptions?: CalendarViewOption[];
    onNavigate?: (href: string) => void;
  },
): DefaultReactSuggestionItem[] {
  const defaults = getDefaultReactSlashMenuItems(editor);

  const pageItem: DefaultReactSuggestionItem = {
    title: "Page",
    subtext: "Create a subpage and link to it",
    group: "Planevo",
    aliases: ["subpage", "child page", "new page"],
    icon: <DocumentPlusIcon className="h-4 w-4" />,
    onItemClick: () => {
      void (async () => {
        const result = await createSubpage({ parentPageId: options.pageId });
        if (!result.ok || !result.pageId) return;
        insertPageLink(editor, result.pageId, "Untitled");
        options.onNavigate?.(`/pages/${result.pageId}`);
      })();
    },
  };

  const databaseItems: DefaultReactSuggestionItem[] = TEMPLATE_CHOICES.map(
    (template) => ({
      title: `Database · ${template.title}`,
      subtext: "Create from template and embed here",
      group: "Planevo",
      aliases: ["database", "table", ...template.aliases],
      icon: <RectangleStackIcon className="h-4 w-4" />,
      onItemClick: () => {
        void (async () => {
          const result = await createDatabaseFromTemplateAction({
            pageId: options.pageId,
            templateType: template.type,
            name: template.title,
          });
          if (!result.ok || !result.databaseId) return;
          insertDatabaseView(editor, result.databaseId);
        })();
      },
    }),
  );

  const embedItems: DefaultReactSuggestionItem[] = options.databaseOptions.map(
    (database) => ({
      title: `Embed · ${database.name}`,
      subtext: "Link an existing database on this page",
      group: "Embed database",
      aliases: ["embed", "link database", database.name],
      icon: <TableCellsIcon className="h-4 w-4" />,
      onItemClick: () => insertDatabaseView(editor, database.id),
    }),
  );

  const calendarEmbedItems: DefaultReactSuggestionItem[] = (
    options.calendarViewOptions ?? []
  ).map((view) => ({
    title: `Calendar · ${view.name}`,
    subtext: "Embed this saved calendar view",
    group: "Embed calendar",
    aliases: ["calendar", "schedule", "embed calendar", view.name],
    icon: <CalendarDaysIcon className="h-4 w-4" />,
    onItemClick: () => insertCalendarEmbed(editor, view.id),
  }));

  return [
    ...defaults,
    pageItem,
    ...databaseItems,
    ...embedItems,
    ...calendarEmbedItems,
  ];
}

/** Fuzzy-filter slash items; falls back to substring when query is empty. */
export function filterPlanevoSlashItems(
  query: string,
  items: DefaultReactSuggestionItem[],
): DefaultReactSuggestionItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;

  return items
    .map((item) => {
      const haystack = [item.title, item.subtext ?? "", ...(item.aliases ?? [])].join(
        " ",
      );
      const match = fuzzyMatch(trimmed, haystack);
      return match ? { item, score: match.score } : null;
    })
    .filter((entry): entry is { item: DefaultReactSuggestionItem; score: number } =>
      Boolean(entry),
    )
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
