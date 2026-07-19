"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildCommandResults,
  type CommandDef,
  type CommandIndexEntry,
  type CommandResultItem,
} from "@planevo/core/search/command-model";
import { parseQuickCapture } from "@planevo/core/parsing/natural-capture";
import {
  APP_PREFERENCES_STORAGE_KEY,
  parseAppPreferences,
  type AppPreferences,
} from "@planevo/core/state/app-preferences";
import { quickCapture, undoQuickCapture } from "@/app/(workspace)/capture-actions";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import { fetchCommandIndex, markCommandIndexStale } from "./command-index-cache";
import { loadCommandRecents, rememberCommandEntry } from "./command-recents";
import { HighlightedText } from "./highlighted-text";

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

function entryHref(entry: CommandIndexEntry): string {
  switch (entry.kind) {
    case "page":
      return `/pages/${entry.id}`;
    case "database":
      return `/databases/${entry.id}`;
    case "record":
      return `/records/${entry.id}`;
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
}

function entryIcon(entry: CommandIndexEntry): "page" | "workspace" | "tasks" {
  switch (entry.kind) {
    case "page":
      return "page";
    case "database":
      return "workspace";
    case "record":
      return "tasks";
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
}

function entryKindLabel(entry: CommandIndexEntry): string {
  switch (entry.kind) {
    case "page":
      return "Page";
    case "database":
      return "Database";
    case "record":
      return "Record";
    default: {
      const exhaustive: never = entry.kind;
      return exhaustive;
    }
  }
}

function isPlainCaptureQuery(query: string): boolean {
  const trimmed = query.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith(">") &&
    !trimmed.startsWith("@") &&
    !trimmed.startsWith("#")
  );
}

function applyMinimalPreference(next: AppPreferences): void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const appearance =
    next.theme === "system"
      ? { theme: media.matches ? "dark" : "light", minimal: next.minimal }
      : { theme: next.theme, minimal: next.minimal };
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.toggleAttribute("data-minimal", appearance.minimal);
}

function CaptureChips({ draft }: { draft: ReturnType<typeof parseQuickCapture> }) {
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
    <div className="flex flex-wrap gap-2 px-4 pb-3">
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

function ResultRow({
  item,
  active,
  onHover,
}: {
  item: CommandResultItem;
  active: boolean;
  onHover: () => void;
}) {
  if (item.type === "capture") {
    const { draft } = item;
    return (
      <button
        type="button"
        onMouseEnter={onHover}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left outline-none ${
          active ? "bg-surface-sunken" : "hover:bg-surface-raised"
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
        onMouseEnter={onHover}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left outline-none ${
          active ? "bg-surface-sunken" : "hover:bg-surface-raised"
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
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left outline-none ${
        active ? "bg-surface-sunken" : "hover:bg-surface-raised"
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

export function CommandBar({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<CommandIndexEntry[]>([]);
  const [recents, setRecents] = useState<CommandIndexEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const results = buildCommandResults({ query, entries, recents });
  const captureDraft =
    results.find((item): item is Extract<CommandResultItem, { type: "capture" }> =>
      item.type === "capture",
    )?.draft ?? (isPlainCaptureQuery(query) ? parseQuickCapture(query) : null);

  const resetForOpen = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setRecents(loadCommandRecents());
  }, []);

  useEffect(() => {
    if (!open) {
      markCommandIndexStale();
      return;
    }

    resetForOpen();
    setLoading(true);
    setLoadError(null);

    void fetchCommandIndex()
      .then((nextEntries) => {
        setEntries(nextEntries);
      })
      .catch((cause) => {
        setLoadError(cause instanceof Error ? cause.message : "Failed to load.");
      })
      .finally(() => {
        setLoading(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      });
  }, [open, resetForOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, entries.length]);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results.length]);

  function closeAndClear(): void {
    setQuery("");
    onClose();
  }

  function navigateToEntry(entry: CommandIndexEntry): void {
    rememberCommandEntry(entry);
    closeAndClear();
    router.push(entryHref(entry));
  }

  function runCommand(command: CommandDef): void {
    closeAndClear();
    switch (command.id) {
      case "new-page":
        startTransition(() => {
          void createPageAndOpen();
        });
        break;
      case "new-database":
        router.push("/templates");
        break;
      case "settings":
        onOpenSettings();
        break;
      case "toggle-minimal": {
        const current = parseAppPreferences(localStorage.getItem(APP_PREFERENCES_STORAGE_KEY));
        const next: AppPreferences = { ...current, minimal: !current.minimal };
        localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        applyMinimalPreference(next);
        break;
      }
      case "search-page":
        router.push("/search");
        break;
      default:
        break;
    }
  }

  function submitCapture(raw: string): void {
    startTransition(async () => {
      try {
        const result = await quickCapture(raw);
        toast(`Added to ${result.databaseName}`, {
          action: {
            label: "Undo",
            onClick: () => {
              startTransition(async () => {
                try {
                  await undoQuickCapture(result.id, result.kind);
                } catch (cause) {
                  toast(cause instanceof Error ? cause.message : "Undo failed.", {
                    tone: "error",
                  });
                }
              });
            },
          },
        });
        setQuery("");
        setActiveIndex(0);
        inputRef.current?.focus();
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Capture failed.", { tone: "error" });
      }
    });
  }

  function handleSubmit(): void {
    if (pending) return;

    const active = results[activeIndex];
    if (active?.type === "capture") {
      submitCapture(query);
      return;
    }
    if (active?.type === "entry") {
      navigateToEntry(active.entry);
      return;
    }
    if (active?.type === "command") {
      runCommand(active.command);
      return;
    }

    if (isPlainCaptureQuery(query) && parseQuickCapture(query).title.trim()) {
      submitCapture(query);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Dialog
      open={open}
      onClose={closeAndClear}
      labelledBy={inputId}
      className="m-auto w-full max-w-xl rounded-card border border-border bg-paper p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="border-b border-border px-4 py-3">
        <label htmlFor={inputId} className="sr-only">
          Command bar
        </label>
        <div className="flex items-center gap-3">
          <Icon name="search" className="size-5 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search, capture, or type > for commands"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      {captureDraft && <CaptureChips draft={captureDraft} />}

      <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
        {loading && (
          <p className="px-4 py-6 text-center text-small text-text-muted">Loading workspace…</p>
        )}
        {!loading && loadError && (
          <p className="px-4 py-6 text-center text-small text-brick">{loadError}</p>
        )}
        {!loading && !loadError && results.length === 0 && (
          <p className="px-4 py-6 text-center text-small text-text-muted">
            {query.trim()
              ? "No matches. Press Enter to capture a task."
              : "Recents appear as you navigate."}
          </p>
        )}
        {!loading &&
          !loadError &&
          results.map((item, index) => (
            <div key={`${item.type}-${index}`} data-index={index}>
              <ResultRow
                item={item}
                active={index === activeIndex}
                onHover={() => setActiveIndex(index)}
              />
            </div>
          ))}
      </div>
    </Dialog>
  );
}
