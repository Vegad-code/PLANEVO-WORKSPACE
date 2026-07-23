"use client";

import {
  SPOTLIGHT_GROUP_LABELS,
  spotlightGroupForItem,
  type CommandIndexEntry,
  type CommandResultItem,
  type SpotlightResultGroup,
} from "@planevo/core/search/command-model";
import { parseQuickCapture } from "@planevo/core/parsing/natural-capture";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import { HighlightedText } from "./highlighted-text";
import type { SpotlightScope } from "./spotlight-scope";

function formatDueChip(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeChip(time: { hour: number; minute: number } | null): string | null {
  if (!time) return null;
  const date = new Date();
  date.setHours(time.hour, time.minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function CaptureChips({ draft }: { draft: ReturnType<typeof parseQuickCapture> }) {
  const due = formatDueChip(draft.dueDate);
  const time = formatTimeChip(draft.time);
  const chips = [
    due ? { key: "due", label: due } : null,
    time ? { key: "time", label: time } : null,
    draft.databaseToken ? { key: "db", label: `#${draft.databaseToken}` } : null,
    draft.priorityToken ? { key: "priority", label: draft.priorityToken } : null,
    draft.personToken ? { key: "person", label: `@${draft.personToken}` } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-5 pb-2 pt-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-text-secondary"
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function entryIcon(entry: CommandIndexEntry): IconName {
  switch (entry.kind) {
    case "page":
      return "page";
    case "database":
      return "workspace";
    case "record":
      return "canvas";
    case "task":
      return "tasks";
    case "file":
      return "files";
    case "event":
      return "calendar";
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
}

export function entryKindLabel(entry: CommandIndexEntry): string {
  switch (entry.kind) {
    case "page":
      return "Page";
    case "database":
      return "Database";
    case "record":
      return "Record";
    case "task":
      return "Task";
    case "file":
      return "File";
    case "event":
      return "Event";
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
}

export function SpotlightResultRow({
  item,
  active,
  onHover,
  onSelect,
}: {
  item: CommandResultItem;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  if (item.type === "capture") {
    const { draft } = item;
    return (
      <button
        type="button"
        role="option"
        aria-selected={active}
        onMouseEnter={onHover}
        onClick={onSelect}
        className={`flex w-full items-start gap-3 px-5 py-2.5 text-left outline-none ${
          active ? "bg-surface-raised/70" : "hover:bg-surface-raised/50"
        }`}
      >
        <Icon name="plus" className="mt-0.5 size-4 shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-ink">
            Add “{draft.title || "…"}”
          </p>
          <p className="mt-0.5 text-small text-text-secondary">Quick capture</p>
          {draft.recurringUnsupported && (
            <p className="mt-1 text-small text-text-muted">
              Recurring isn&apos;t supported yet — created once.
            </p>
          )}
        </div>
      </button>
    );
  }

  if (item.type === "command") {
    return (
      <button
        type="button"
        role="option"
        aria-selected={active}
        onMouseEnter={onHover}
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left outline-none ${
          active ? "bg-surface-raised/70" : "hover:bg-surface-raised/50"
        }`}
      >
        <Icon name="search" className="size-4 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 text-body font-medium text-ink">
          <HighlightedText text={item.command.title} ranges={item.ranges} />
        </span>
        <span className="text-label uppercase text-text-muted">Command</span>
      </button>
    );
  }

  const { entry } = item;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-5 py-2.5 text-left outline-none ${
        active ? "bg-surface-raised/70" : "hover:bg-surface-raised/50"
      }`}
    >
      <Icon name={entryIcon(entry)} className="size-4 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">
          <HighlightedText text={entry.title} ranges={item.ranges} />
        </p>
        {entry.subtitle && (
          <p className="truncate text-small text-text-secondary">{entry.subtitle}</p>
        )}
      </div>
      <span className="text-label uppercase text-text-muted">{entryKindLabel(entry)}</span>
    </button>
  );
}

type SpotlightResultsProps = {
  results: CommandResultItem[];
  activeIndex: number;
  loading: boolean;
  loadError: string | null;
  query: string;
  listId: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
  emptyQuery: boolean;
  activeScope: SpotlightScope | null;
};

const GROUP_ORDER: SpotlightResultGroup[] = [
  "capture",
  "commands",
  "tasks",
  "files",
  "calendar",
  "workspace",
];

export function SpotlightResults({
  results,
  activeIndex,
  loading,
  loadError,
  query,
  listId,
  listRef,
  onHover,
  onSelect,
  emptyQuery,
  activeScope,
}: SpotlightResultsProps) {
  const captureAllowed = activeScope === null || activeScope === "tasks";
  const visibleResults = captureAllowed
    ? results
    : results.filter((item) => item.type !== "capture");
  const grouped = new Map<SpotlightResultGroup, { item: CommandResultItem; index: number }[]>();

  for (let index = 0; index < visibleResults.length; index += 1) {
    const item = visibleResults[index]!;
    const group = emptyQuery ? "recents" : spotlightGroupForItem(item);
    const bucket = grouped.get(group) ?? [];
    bucket.push({ item, index });
    grouped.set(group, bucket);
  }

  const orderedGroups = emptyQuery
    ? (["recents"] as const)
    : GROUP_ORDER.filter((group) => grouped.has(group));

  const captureDraft =
    (captureAllowed &&
      visibleResults.find((item): item is Extract<CommandResultItem, { type: "capture" }> =>
        item.type === "capture",
      )?.draft) ?? null;

  return (
    <div
      id={listId}
      ref={listRef}
      role="listbox"
      aria-label="Search results"
      className="max-h-[min(24rem,45vh)] overflow-y-auto py-1"
    >
      {captureDraft && <CaptureChips draft={captureDraft} />}
      {loading && (
        <p className="px-5 py-8 text-center text-small text-text-muted">Loading your account…</p>
      )}
      {!loading && loadError && (
        <p className="px-5 py-8 text-center text-small text-brick">{loadError}</p>
      )}
      {!loading && !loadError && visibleResults.length === 0 && (
        <p className="px-5 py-8 text-center text-small text-text-muted">
          {query.trim()
            ? activeScope === "tasks" || activeScope === null
              ? "No matches. Press Enter to capture a task."
              : "No matches."
            : "Type to search."}
        </p>
      )}
      {!loading &&
        !loadError &&
        orderedGroups.map((group) => {
          const rows = grouped.get(group) ?? [];
          if (rows.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-5 pt-2 pb-1 text-label uppercase tracking-wide text-text-muted">
                {SPOTLIGHT_GROUP_LABELS[group]}
              </p>
              {rows.map(({ item, index }) => (
                <div key={`${item.type}-${index}`} data-index={index}>
                  <SpotlightResultRow
                    item={item}
                    active={index === activeIndex}
                    onHover={() => onHover(index)}
                    onSelect={() => onSelect(index)}
                  />
                </div>
              ))}
            </div>
          );
        })}
    </div>
  );
}
