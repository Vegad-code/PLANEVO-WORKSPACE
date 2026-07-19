"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CatalogIcon } from "@planevo/core/tasks/icon-catalog";
import { resolveIconDefinition } from "@planevo/core/tasks/icon-catalog";
import {
  EMOJI_CATALOG,
  searchEmojiCatalog,
  type EmojiCatalogEntry,
} from "@planevo/core/tasks/emoji-catalog";
import { TASK_ICON_REGISTRY } from "@planevo/core/tasks/task-icon-registry";
import type { TaskIconRef, TaskIconStyle } from "@planevo/core/tasks/task-icon-types";
import { emojiToId } from "@planevo/core/tasks/task-icon-types";
import { searchTaskIconsAction } from "@/app/(workspace)/tasks/actions";
import { useOutsidePointer } from "@/features/database/use-outside-pointer";
import { TaskIconRender } from "./task-icon-render";

type TaskIconPickerProps = {
  currentIconRef: TaskIconRef;
  onSelect: (icon: TaskIconRef) => void;
  onClose: () => void;
};

const STYLE_OPTIONS: { id: TaskIconStyle; label: string }[] = [
  { id: "plain", label: "Plain" },
  { id: "emoji", label: "Emoji" },
];

const SUGGESTED_EMOJIS = EMOJI_CATALOG.slice(0, 24);

function catalogToDefinition(icon: CatalogIcon) {
  return resolveIconDefinition(icon.id)!;
}

export function TaskIconPicker({
  currentIconRef,
  onSelect,
  onClose,
}: TaskIconPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [iconResults, setIconResults] = useState<CatalogIcon[]>([]);
  const [isSearchingIcons, startIconSearch] = useTransition();
  const [style, setStyle] = useState<TaskIconStyle>(
    currentIconRef.style === "emoji" ? "emoji" : "plain",
  );

  useOutsidePointer(ref, true, onClose);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (style !== "plain" || query.trim().length < 2) {
      setIconResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      startIconSearch(async () => {
        const response = await searchTaskIconsAction({ query: query.trim() });
        if (response.ok) setIconResults(response.data);
      });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, style]);

  const emojiResults = useMemo(() => {
    if (style !== "emoji") return [];
    return searchEmojiCatalog(query.trim(), 24);
  }, [query, style]);

  function handlePickPlain(iconId: string) {
    onSelect({
      id: iconId,
      source: "user",
      style: "plain",
    });
  }

  function handlePickEmoji(entry: EmojiCatalogEntry) {
    onSelect({
      id: emojiToId(entry.emoji),
      emoji: entry.emoji,
      source: "user",
      style: "emoji",
    });
  }

  const currentDefinition = resolveIconDefinition(
    currentIconRef.id,
    currentIconRef.emoji,
  );

  const showPlainSearch = style === "plain" && query.trim().length >= 2;
  const showEmojiSearch = style === "emoji" && query.trim().length >= 1;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose task icon"
      className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-xl border border-border bg-surface-raised p-3 shadow-none"
    >
      <p className="text-label uppercase text-text-muted">Task icon</p>

      <div className="mt-3 flex items-center gap-2">
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={style === option.id}
            onClick={() => setStyle(option.id)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-label outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
              style === option.id
                ? "border-border-strong bg-paper text-ink"
                : "border-border text-text-secondary hover:border-border-strong"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="sr-only">
          {style === "emoji" ? "Search emojis" : "Search icons"}
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            style === "emoji" ? "Search emojis…" : "Search 2,000+ icons…"
          }
          className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-small text-ink outline-none focus-visible:border-border-strong"
        />
      </label>

      {style === "plain" && showPlainSearch ? (
        <ul className="mt-2 max-h-40 overflow-y-auto">
          {isSearchingIcons ? (
            <li className="px-2 py-3 text-small text-text-muted">Searching…</li>
          ) : iconResults.length === 0 ? (
            <li className="px-2 py-3 text-small text-text-muted">No icons found</li>
          ) : (
            iconResults.map((icon) => (
              <li key={icon.id}>
                <button
                  type="button"
                  onClick={() => handlePickPlain(icon.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <TaskIconRender
                    definition={catalogToDefinition(icon)}
                    style="plain"
                    size="picker"
                  />
                  <span className="truncate text-small text-text-secondary">
                    {icon.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {style === "emoji" && showEmojiSearch ? (
        <ul className="mt-2 max-h-40 overflow-y-auto">
          {emojiResults.length === 0 ? (
            <li className="px-2 py-3 text-small text-text-muted">No emojis found</li>
          ) : (
            emojiResults.map((entry) => (
              <li key={entry.emoji}>
                <button
                  type="button"
                  onClick={() => handlePickEmoji(entry)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <TaskIconRender
                    definition={resolveIconDefinition(
                      emojiToId(entry.emoji),
                      entry.emoji,
                    )!}
                    style="emoji"
                    size="picker"
                  />
                  <span className="truncate text-small text-text-secondary">
                    {entry.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {!showPlainSearch && !showEmojiSearch ? (
        <>
          <p className="mt-2 text-label text-text-muted">Suggested</p>
          {style === "plain" ? (
            <ul className="mt-1 grid grid-cols-4 gap-1">
              {TASK_ICON_REGISTRY.map((entry) => {
                const isSelected = entry.id === currentIconRef.id;

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-label={entry.label}
                      aria-pressed={isSelected}
                      title={entry.label}
                      onClick={() => handlePickPlain(entry.id)}
                      className={`flex size-11 items-center justify-center rounded-lg outline-none transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                        isSelected
                          ? "bg-paper ring-1 ring-inset ring-border-strong text-ink"
                          : "text-text-secondary"
                      }`}
                    >
                      <TaskIconRender
                        definition={entry}
                        style="plain"
                        size="picker"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mt-1 grid grid-cols-6 gap-1">
              {SUGGESTED_EMOJIS.map((entry) => {
                const isSelected = currentIconRef.emoji === entry.emoji;

                return (
                  <li key={entry.emoji}>
                    <button
                      type="button"
                      aria-label={entry.label}
                      aria-pressed={isSelected}
                      title={entry.label}
                      onClick={() => handlePickEmoji(entry)}
                      className={`flex size-10 items-center justify-center rounded-lg outline-none transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                        isSelected
                          ? "bg-paper ring-1 ring-inset ring-border-strong"
                          : ""
                      }`}
                    >
                      <TaskIconRender
                        definition={resolveIconDefinition(
                          emojiToId(entry.emoji),
                          entry.emoji,
                        )!}
                        style="emoji"
                        size="picker-grid"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {currentDefinition ? (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-label text-text-muted">
          <TaskIconRender
            definition={currentDefinition}
            style={currentIconRef.style}
            size="picker"
          />
          <span>Current: {currentDefinition.label}</span>
        </div>
      ) : null}
    </div>
  );
}
