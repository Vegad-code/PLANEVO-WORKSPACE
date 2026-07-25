"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildCommandResults,
  type CommandDef,
  type CommandIndexEntry,
} from "@planevo/core/search/command-model";
import { parseQuickCapture } from "@planevo/core/parsing/natural-capture";
import {
  APP_PREFERENCES_STORAGE_KEY,
  parseAppPreferences,
  type AppPreferences,
} from "@planevo/core/state/app-preferences";
import { quickCapture, undoQuickCapture } from "@/app/(workspace)/capture-actions";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { toast } from "@/components/ui/toast";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { fetchCommandIndex, markCommandIndexStale } from "./command-index-cache";
import { loadCommandRecents, rememberCommandEntry } from "./command-recents";
import { SpotlightOverlay } from "./spotlight-overlay";
import { SpotlightChrome } from "./spotlight-chrome";
import { SpotlightSearchField } from "./spotlight-search-field";
import { SpotlightResults } from "./spotlight-results";
import {
  filterEntriesByScope,
  loadSpotlightScope,
  saveSpotlightScope,
  setSpotlightScope,
  type SpotlightScope,
} from "./spotlight-scope";

function entryHref(entry: CommandIndexEntry): string {
  switch (entry.kind) {
    case "page":
      return `/pages/${entry.id}`;
    case "database":
      return `/databases/${entry.id}`;
    case "record":
      return `/records/${entry.id}`;
    case "task":
      return `/tasks?highlight=${entry.id}`;
    case "file":
      return `/files?file=${entry.id}`;
    case "event":
      return `/calendar?event=${entry.id}`;
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

export function CommandBar({
  open,
  onClose,
  onOpenSettings,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<CommandIndexEntry[]>([]);
  const [recents, setRecents] = useState<CommandIndexEntry[]>([]);
  const [activeScope, setActiveScope] = useState<SpotlightScope | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const scopedEntries = filterEntriesByScope(entries, activeScope);
  const scopedRecents = filterEntriesByScope(recents, activeScope);
  const results = buildCommandResults({
    query,
    entries: scopedEntries,
    recents: scopedRecents,
  });

  const trimmedQuery = query.trim();
  const expanded = trimmedQuery !== "" || loadError !== null;

  const handleClearScope = useCallback(() => {
    setActiveScope(null);
    saveSpotlightScope(null);
    setActiveIndex(0);
    inputRef.current?.focus();
  }, []);

  function closeAndClear(): void {
    setQuery("");
    setActiveScope(null);
    saveSpotlightScope(null);
    onClose();
  }

  const handleEscape = useCallback((): boolean => {
    if (activeScope) {
      handleClearScope();
      return true;
    }
    return false;
  }, [activeScope, handleClearScope]);

  const handleScopeAction = useCallback(
    (scope: SpotlightScope) => {
      setActiveScope((current) => {
        const next = setSpotlightScope(current, scope);
        saveSpotlightScope(next);
        return next;
      });
      setActiveIndex(0);
      inputRef.current?.focus();
    },
    [],
  );

  const resetForOpen = useCallback(() => {
    setQuery(initialQuery?.trim() ? initialQuery : "");
    setActiveIndex(0);
    setRecents(loadCommandRecents());
  }, [initialQuery]);

  useEffect(() => {
    if (!open) {
      markCommandIndexStale();
      return;
    }

    resetForOpen();
    setActiveScope(loadSpotlightScope());
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
  }, [query, scopedEntries.length, activeScope]);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results.length]);

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

  function handleSubmitAt(index: number): void {
    if (pending) return;

    const active = results[index];
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

    const captureAllowed =
      activeScope !== "files" &&
      activeScope !== "calendar" &&
      activeScope !== "workspace";
    if (
      captureAllowed &&
      isPlainCaptureQuery(query) &&
      parseQuickCapture(query).title.trim()
    ) {
      submitCapture(query);
    }
  }

  function handleSubmit(): void {
    handleSubmitAt(activeIndex);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      if (activeScope) {
        event.preventDefault();
        handleClearScope();
      }
      return;
    }

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

  function renderResultsPanel() {
    return (
      <SpotlightResults
        results={results}
        activeIndex={activeIndex}
        loading={loading}
        loadError={loadError}
        query={query}
        listId={listId}
        listRef={listRef}
        onHover={setActiveIndex}
        onSelect={handleSubmitAt}
        emptyQuery={false}
        activeScope={activeScope}
      />
    );
  }

  return (
    <SpotlightOverlay
      open={open}
      onClose={closeAndClear}
      onEscape={handleEscape}
      prefersReducedMotion={prefersReducedMotion}
    >
      <SpotlightChrome
        expanded={expanded}
        activeScope={activeScope}
        onScopeAction={handleScopeAction}
        searchField={
          <SpotlightSearchField
            inputId={inputId}
            listId={listId}
            inputRef={inputRef}
            value={query}
            expanded={expanded}
            activeScope={activeScope}
            onClearScope={handleClearScope}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
          />
        }
        results={renderResultsPanel()}
      />
    </SpotlightOverlay>
  );
}
