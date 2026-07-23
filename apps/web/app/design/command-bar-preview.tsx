"use client";

import type { ReactNode } from "react";
import type { QuickCaptureDraft } from "@planevo/core/parsing/natural-capture";
import type { CommandResultItem } from "@planevo/core/search/command-model";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import { cn } from "@/lib/utils";
import {
  SPOTLIGHT_SCOPE_ITEMS,
  type SpotlightScope,
} from "@/features/command-bar/spotlight-scope";

const SAMPLE_CAPTURE: QuickCaptureDraft = {
  title: "Physics homework",
  dueDate: new Date("2026-07-18T07:00:00.000Z").toISOString(),
  priority: "High",
  status: null,
  time: { hour: 18, minute: 0 },
  databaseToken: "school",
  personToken: null,
  priorityToken: "high",
  recurringUnsupported: false,
  consumedRanges: [],
};

const SAMPLE_RESULTS: CommandResultItem[] = [
  {
    type: "capture",
    draft: SAMPLE_CAPTURE,
  },
  {
    type: "entry",
    entry: { kind: "task", id: "t1", title: "Physics lab prep", subtitle: "todo" },
    ranges: [[0, 7]],
  },
  {
    type: "entry",
    entry: { kind: "file", id: "f1", title: "Physics syllabus.pdf" },
    ranges: [[0, 7]],
  },
  {
    type: "entry",
    entry: { kind: "event", id: "e1", title: "Physics office hours", subtitle: "Jul 18, 2:00 PM" },
    ranges: [[0, 7]],
  },
];

function ScopeIconsPreview({ activeScope }: { activeScope: SpotlightScope | null }) {
  return (
    <div className="flex shrink-0 gap-2">
      {SPOTLIGHT_SCOPE_ITEMS.map((item) => {
        const active = activeScope === item.scope;
        return (
          <div
            key={item.scope}
            className={cn(
              "spotlight-glass-icon flex size-11 items-center justify-center rounded-full",
              active ? "bg-surface-raised/80 text-ink ring-1 ring-border" : "text-text-secondary",
            )}
            aria-hidden
          >
            <Icon name={item.icon as IconName} className="size-5" />
          </div>
        );
      })}
    </div>
  );
}

function PreviewChrome({
  label,
  query,
  expanded,
  activeScope = null,
  children,
}: {
  label: string;
  query: string;
  expanded: boolean;
  activeScope?: SpotlightScope | null;
  children: ReactNode;
}) {
  const scopeLabel = activeScope
    ? SPOTLIGHT_SCOPE_ITEMS.find((item) => item.scope === activeScope)?.label
    : null;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-paper">
      <p className="border-b border-border px-4 py-2 text-label uppercase text-text-muted">
        {label}
      </p>
      <div className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="spotlight-glass-shell min-w-0 w-full overflow-hidden md:flex-1">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Icon name="search" className="size-5 shrink-0 text-text-secondary" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-h3 text-text-muted">
                  {query || "Find anything…"}
                </span>
                {scopeLabel ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-ink">
                    {scopeLabel}
                    <span className="text-text-secondary">×</span>
                  </span>
                ) : null}
              </div>
            </div>
            {expanded && children ? (
              <div className="border-t border-border/60">{children}</div>
            ) : null}
          </div>
          <ScopeIconsPreview activeScope={activeScope} />
        </div>
      </div>
    </div>
  );
}

function kindIcon(kind: string) {
  switch (kind) {
    case "task":
      return "tasks" as const;
    case "file":
      return "files" as const;
    case "event":
      return "calendar" as const;
    default:
      return "search" as const;
  }
}

function PreviewRow({ item, active }: { item: CommandResultItem; active: boolean }) {
  if (item.type === "capture") {
    return (
      <div
        className={`flex items-start gap-3 px-5 py-2.5 ${
          active ? "bg-surface-raised/70" : "bg-transparent"
        }`}
      >
        <Icon name="plus" className="mt-0.5 size-4 text-text-muted" />
        <div>
          <p className="text-body font-medium text-ink">Add “{item.draft.title}”</p>
          <p className="text-small text-text-secondary">Quick capture</p>
        </div>
      </div>
    );
  }

  if (item.type === "command") {
    return (
      <div
        className={`flex items-center gap-3 px-5 py-2.5 ${
          active ? "bg-surface-raised/70" : "bg-transparent"
        }`}
      >
        <Icon name="search" className="size-4 text-text-muted" />
        <span className="flex-1 text-body font-medium text-ink">{item.command.title}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-5 py-2.5 ${
        active ? "bg-surface-raised/70" : "bg-transparent"
      }`}
    >
      <Icon name={kindIcon(item.entry.kind)} className="size-4 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{item.entry.title}</p>
        {item.entry.subtitle && (
          <p className="truncate text-small text-text-secondary">{item.entry.subtitle}</p>
        )}
      </div>
    </div>
  );
}

/** Static /design preview of Spotlight pill states (no router or fetch). */
export function CommandBarPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PreviewChrome label="Collapsed — pill only" query="" expanded={false}>
        {null}
      </PreviewChrome>

      <PreviewChrome label="Typed — morph + results" query="Physics" expanded activeScope="tasks">
        <p className="px-5 pt-2 pb-1 text-label uppercase tracking-wide text-text-muted">Tasks</p>
        <PreviewRow item={SAMPLE_RESULTS[1]!} active />
      </PreviewChrome>

      <PreviewChrome label="Scope chip — pill until typed" query="" expanded={false} activeScope="tasks">
        {null}
      </PreviewChrome>

      <PreviewChrome label="Match highlight token" query="physics" expanded>
        <p className="px-5 pt-2 pb-1 text-label uppercase tracking-wide text-text-muted">Tasks</p>
        <div className="flex items-center gap-3 px-5 py-2.5">
          <Icon name="tasks" className="size-4 text-text-muted" />
          <span className="text-body font-medium text-ink">
            do <span className="spotlight-match">math</span>
          </span>
        </div>
        <PreviewRow item={SAMPLE_RESULTS[1]!} active={false} />
      </PreviewChrome>

      <PreviewChrome label="Capture — physics homework friday 6pm" query="Physics homework friday 6pm" expanded activeScope="tasks">
        <div className="flex flex-wrap gap-2 px-5 pb-2 pt-1">
          {["Fri, Jul 18", "6:00 PM", "#school", "high"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-text-secondary"
            >
              {chip}
            </span>
          ))}
        </div>
        <PreviewRow item={SAMPLE_RESULTS[0]!} active />
      </PreviewChrome>
    </div>
  );
}
