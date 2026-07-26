"use client";

import { cn } from "@/lib/utils";

export type EventCaptureMode = "quick" | "details";

const MODES: { value: EventCaptureMode; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "details", label: "Details" },
];

/**
 * Switches the create card between the one-line capture and the full form.
 * Both write the same event, so this only changes how you say it.
 *
 * Class recipe matches the database view tabs — the app's established tab
 * pattern. There is no shared segmented-control primitive, and one call site
 * does not justify inventing one.
 */
export function EventCaptureModeToggle({
  mode,
  onModeChange,
}: {
  mode: EventCaptureMode;
  onModeChange: (mode: EventCaptureMode) => void;
}) {
  function handleKeyDown(keyEvent: React.KeyboardEvent<HTMLDivElement>) {
    if (keyEvent.key !== "ArrowLeft" && keyEvent.key !== "ArrowRight") return;
    keyEvent.preventDefault();
    const currentIndex = MODES.findIndex((entry) => entry.value === mode);
    const offset = keyEvent.key === "ArrowRight" ? 1 : -1;
    const next = MODES[(currentIndex + offset + MODES.length) % MODES.length]!;
    onModeChange(next.value);
  }

  return (
    <div
      role="tablist"
      aria-label="Event entry mode"
      onKeyDown={handleKeyDown}
      className="flex gap-0.5 rounded-[var(--radius-calendar-control)] bg-surface-raised p-0.5"
    >
      {MODES.map((entry) => {
        const isActive = entry.value === mode;
        return (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onModeChange(entry.value)}
            className={cn(
              "rounded-[var(--radius-calendar-control)] px-2.5 py-1 text-product-meta font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
              isActive
                ? "bg-ink text-paper"
                : "text-text-secondary hover:text-ink",
            )}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
