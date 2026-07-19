"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Small curated set — enough for page icons without an emoji-mart dependency. */
const EMOJI_GRID = [
  "📄",
  "📝",
  "📚",
  "💡",
  "🎯",
  "✅",
  "🗓️",
  "📁",
  "🔬",
  "🧪",
  "🧠",
  "🌱",
  "🚀",
  "⭐",
  "❤️",
  "🔥",
  "🏠",
  "🧳",
  "🎨",
  "🎵",
  "📷",
  "🧩",
  "🛠️",
  "📌",
  "🔗",
  "💬",
  "📊",
  "🗂️",
  "🌐",
  "🔒",
  "☀️",
  "🌙",
  "☕",
  "🍎",
  "🌿",
  "🦋",
] as const;

type EmojiPickerProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
  /** Accessible name for the trigger button. */
  label?: string;
};

/**
 * Token-styled emoji popover for page icons. Hand-rolled grid — no new deps.
 */
export function EmojiPicker({
  value,
  onChange,
  label = "Page icon",
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-12 items-center justify-center rounded-lg text-h2 outline-none hover:bg-sidebar focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {value ? (
          <span aria-hidden className="leading-none">
            {value}
          </span>
        ) : (
          <span className="text-small text-text-muted">Add</span>
        )}
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Choose an emoji"
          className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-surface-raised p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-label uppercase text-text-muted">Icon</p>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-small text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_GRID.map((emoji) => {
              const selected = value === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Set icon to ${emoji}`}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-body outline-none hover:bg-sidebar focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    selected ? "bg-sidebar ring-1 ring-border-strong" : ""
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
