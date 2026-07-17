"use client";

import { useState, useTransition } from "react";
import type { DatabaseTemplateType } from "@planevo/core/types/property-types";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import { createDatabaseFromTemplate } from "./actions";

type TemplateOption = {
  type: DatabaseTemplateType;
  name: string;
  description: string;
  icon: IconName;
};

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    type: "task",
    name: "Task",
    description: "Status, due dates, and priority with board, list, and calendar views.",
    icon: "tasks",
  },
  {
    type: "notes",
    name: "Notes",
    description: "Tags and created dates with a list sorted newest first.",
    icon: "page",
  },
  {
    type: "project",
    name: "Project",
    description: "Owners, timelines, and linked tasks with board and calendar views.",
    icon: "workspace",
  },
  {
    type: "files",
    name: "Files",
    description: "Type, tags, and relations organized in table and list views.",
    icon: "files",
  },
  {
    type: "custom",
    name: "Blank",
    description: "A name column and table view — build the rest yourself.",
    icon: "plus",
  },
];

export function TemplatePicker() {
  const [isPending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<DatabaseTemplateType | null>(null);

  function handleSelect(templateType: DatabaseTemplateType) {
    if (isPending) return;
    setActiveType(templateType);
    startTransition(async () => {
      await createDatabaseFromTemplate(templateType);
    });
  }

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATE_OPTIONS.map((template) => {
        const isCreating = isPending && activeType === template.type;

        return (
          <button
            key={template.type}
            type="button"
            disabled={isPending}
            onClick={() => handleSelect(template.type)}
            className={[
              "rounded-card border border-border bg-surface-raised p-4 text-left outline-none transition-colors",
              "hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
              "disabled:cursor-not-allowed disabled:opacity-70",
              isCreating ? "border-border-strong" : "",
            ].join(" ")}
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary">
              <Icon name={template.icon} className="size-4" />
            </span>
            <span className="mt-4 block text-body font-medium text-ink">{template.name}</span>
            <span className="mt-2 block text-small text-text-secondary">{template.description}</span>
            {isCreating ? (
              <span className="mt-4 block text-label uppercase text-text-muted">Creating…</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
