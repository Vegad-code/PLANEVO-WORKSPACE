"use client";

import type { CommandIndexEntry } from "@planevo/core/search/command-model";
import type { IconName } from "@/components/ui/planevo-icon";
import { Icon } from "@/components/ui/planevo-icon";
import { SpotlightResultRow } from "./spotlight-results";
import type { SpotlightScope } from "./spotlight-scope";

const SCOPE_META = {
  tasks: { icon: "tasks", title: "Tasks", empty: "No tasks yet." },
  calendar: { icon: "calendar", title: "Calendar", empty: "No events yet." },
  workspace: { icon: "workspace", title: "Workspace", empty: "No workspace items yet." },
} as const satisfies Record<
  Exclude<SpotlightScope, "files">,
  { icon: IconName; title: string; empty: string }
>;

type SpotlightScopedListProps = {
  scope: Exclude<SpotlightScope, "files">;
  items: CommandIndexEntry[];
  loading: boolean;
  activeIndex: number;
  listId: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
};

export function SpotlightScopedList({
  scope,
  items,
  loading,
  activeIndex,
  listId,
  listRef,
  onHover,
  onSelect,
}: SpotlightScopedListProps) {
  const meta = SCOPE_META[scope];

  return (
    <div
      id={listId}
      ref={listRef}
      role="listbox"
      aria-label={`${meta.title} browse`}
      className="max-h-[min(24rem,45vh)] overflow-y-auto py-1"
    >
      <div className="flex items-center gap-2 px-5 pt-3 pb-2">
        <Icon name={meta.icon} className="size-5 text-text-secondary" />
        <h3 className="text-h3 font-normal text-ink">{meta.title}</h3>
      </div>
      {loading ? (
        <p className="px-5 py-6 text-center text-small text-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-center text-small text-text-muted">{meta.empty}</p>
      ) : (
        items.map((entry, index) => (
          <div key={`${entry.kind}-${entry.id}`} data-index={index}>
            <SpotlightResultRow
              item={{ type: "entry", entry, ranges: [] }}
              active={index === activeIndex}
              onHover={() => onHover(index)}
              onSelect={() => onSelect(index)}
            />
          </div>
        ))
      )}
    </div>
  );
}
