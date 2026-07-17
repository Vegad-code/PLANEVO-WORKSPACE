"use client";

import { useEffect, useState } from "react";

type SaveIndicatorState = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Subtle save chrome. "Saved" fades out on its own after a successful flush.
 */
export function SaveIndicator({
  state,
  errorMessage,
}: {
  state: SaveIndicatorState;
  errorMessage?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (state === "idle") {
      setVisible(false);
      setFading(false);
      return;
    }

    if (state !== "saved") {
      setVisible(true);
      setFading(false);
      return;
    }

    setVisible(true);
    setFading(false);
    const fadeTimer = window.setTimeout(() => setFading(true), 1200);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      setFading(false);
    }, 1800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [state]);

  if (!visible) return null;

  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? (errorMessage ?? "Retrying…")
          : "Unsaved changes";

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
