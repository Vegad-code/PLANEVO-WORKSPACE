"use client";

import type { ReactNode } from "react";
import type { QuickCaptureDraft } from "@planevo/core/parsing/natural-capture";
import type { CommandResultItem } from "@planevo/core/search/command-model";
import { Icon } from "@/components/ui/planevo-icon";

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
    entry: { kind: "database", id: "db-school", title: "School" },
    ranges: [[0, 6]],
  },
  {
    type: "entry",
    entry: { kind: "record", id: "rec-1", title: "Physics lab report", subtitle: "School" },
    ranges: [[0, 7]],
  },
];

function PreviewShell({
  label,
  query,
  children,
}: {
  label: string;
  query: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-paper">
      <p className="border-b border-border px-4 py-2 text-label uppercase text-text-muted">
        {label}
      </p>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon name="search" className="size-5 text-text-muted" />
          <span className="text-body text-ink">{query}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function PreviewRow({ item, active }: { item: CommandResultItem; active: boolean }) {
  if (item.type === "capture") {
    return (
      <div
        className={`flex items-start gap-3 px-4 py-3 ${
          active ? "bg-surface-sunken" : "bg-paper"
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
        className={`flex items-center gap-3 px-4 py-3 ${
          active ? "bg-surface-sunken" : "bg-paper"
        }`}
      >
        <Icon name="search" className="size-4 text-text-muted" />
        <span className="flex-1 text-body font-medium text-ink">{item.command.title}</span>
        <span className="text-label uppercase text-text-muted">Command</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        active ? "bg-surface-sunken" : "bg-paper"
      }`}
    >
      <Icon
        name={item.entry.kind === "page" ? "page" : item.entry.kind === "database" ? "workspace" : "tasks"}
        className="size-4 text-text-muted"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{item.entry.title}</p>
        {item.entry.subtitle && (
          <p className="truncate text-small text-text-secondary">{item.entry.subtitle}</p>
        )}
      </div>
      <span className="text-label uppercase text-text-muted">
        {item.entry.kind === "page" ? "Page" : item.entry.kind === "database" ? "Database" : "Record"}
      </span>
    </div>
  );
}

/** Static /design preview of command bar states (no router or fetch). */
export function CommandBarPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PreviewShell label="Empty — recents" query="">
        <div className="px-4 py-6 text-center text-small text-text-muted">
          Recents appear as you navigate.
        </div>
      </PreviewShell>

      <PreviewShell label="Capture — physics homework friday 6pm #school" query="Physics homework friday 6pm #school">
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {["Fri, Jul 18", "6:00 PM", "#school", "high"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-text-secondary"
            >
              {chip}
            </span>
          ))}
        </div>
        {SAMPLE_RESULTS.map((item, index) => (
          <PreviewRow key={`${item.type}-${index}`} item={item} active={index === 0} />
        ))}
      </PreviewShell>

      <PreviewShell label="Recurring note" query="Review notes every monday">
        <div className="px-4 py-3 text-small text-text-muted">
          Recurring isn&apos;t supported yet — created once.
        </div>
        <PreviewRow
          item={{
            type: "capture",
            draft: {
              ...SAMPLE_CAPTURE,
              title: "Review notes",
              recurringUnsupported: true,
              databaseToken: null,
              time: null,
              dueDate: null,
              priorityToken: null,
              priority: null,
            },
          }}
          active
        />
      </PreviewShell>

      <PreviewShell label="Commands" query=">new page">
        <PreviewRow
          item={{ type: "command", command: { id: "new-page", title: "New page" }, ranges: [] }}
          active
        />
        <PreviewRow
          item={{
            type: "command",
            command: { id: "new-database", title: "New database" },
            ranges: [],
          }}
          active={false}
        />
      </PreviewShell>
    </div>
  );
}
