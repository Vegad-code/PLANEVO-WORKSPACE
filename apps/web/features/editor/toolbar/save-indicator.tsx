"use client";

import { useEffect, useState } from "react";

type SaveIndicatorState = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Subtle save chrome. "Saved" fades out on its own after a successful flush.
 */
export function SaveIndicator({
  state,
  errorMessage,
  savedLabel = "Saved",
  savingLabel = "Saving…",
  dirtyLabel = "Unsaved changes",
}: {
  state: SaveIndicatorState;
  errorMessage?: string | null;
  savedLabel?: string;
  savingLabel?: string;
  dirtyLabel?: string;
}) {
  if (state === "idle") return null;

  return (
    <VisibleSaveIndicator
      key={state}
      state={state}
      errorMessage={errorMessage}
      savedLabel={savedLabel}
      savingLabel={savingLabel}
      dirtyLabel={dirtyLabel}
    />
  );
}

function VisibleSaveIndicator({
  state,
  errorMessage,
  savedLabel,
  savingLabel,
  dirtyLabel,
}: {
  state: Exclude<SaveIndicatorState, "idle">;
  errorMessage?: string | null;
  savedLabel: string;
  savingLabel: string;
  dirtyLabel: string;
}) {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (state !== "saved") return;
    const fadeTimer = window.setTimeout(() => setFading(true), 1200);
    const hideTimer = window.setTimeout(() => setHidden(true), 1800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [state]);

  if (hidden) return null;

  const label =
    state === "saving"
      ? savingLabel
      : state === "saved"
        ? savedLabel
        : state === "error"
          ? (errorMessage ?? "Retrying…")
          : dirtyLabel;

  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-label transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      } ${state === "error" ? "text-brick" : "text-text-muted"}`}
    >
      {label}
    </p>
  );
}
