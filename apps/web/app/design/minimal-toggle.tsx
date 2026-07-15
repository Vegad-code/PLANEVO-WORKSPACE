"use client";

import { useEffect, useState } from "react";
import {
  APP_PREFERENCES_STORAGE_KEY,
  DEFAULT_APP_PREFERENCES,
  getRootAppearance,
  parseAppPreferences,
  type AppPreferences,
  type ThemePreference,
} from "../components/app-preferences";

function applyPreferences(preferences: AppPreferences, systemDark: boolean) {
  const appearance = getRootAppearance(preferences, systemDark);
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.toggleAttribute("data-minimal", appearance.minimal);
}

export function MinimalToggle() {
  const [preferences, setPreferences] = useState<AppPreferences>(
    DEFAULT_APP_PREFERENCES,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const restoreTimer = window.setTimeout(() => {
      const restored = parseAppPreferences(
        localStorage.getItem(APP_PREFERENCES_STORAGE_KEY),
      );
      setPreferences(restored);
      applyPreferences(restored, media.matches);
    }, 0);

    function followSystemAppearance() {
      const stored = parseAppPreferences(
        localStorage.getItem(APP_PREFERENCES_STORAGE_KEY),
      );
      if (stored.theme === "system") {
        applyPreferences(stored, media.matches);
      }
    }

    media.addEventListener("change", followSystemAppearance);
    return () => {
      window.clearTimeout(restoreTimer);
      media.removeEventListener("change", followSystemAppearance);
    };
  }, []);

  function updatePreferences(next: AppPreferences) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    applyPreferences(next, media.matches);
    setPreferences(next);
  }

  function setTheme(theme: ThemePreference) {
    updatePreferences({ ...preferences, theme });
  }

  function toggleMinimal() {
    updatePreferences({ ...preferences, minimal: !preferences.minimal });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex rounded-full border border-border bg-surface-raised p-1" aria-label="Theme preference">
        {(["light", "dark", "system"] as const).map((theme) => (
          <button
            key={theme}
            type="button"
            aria-pressed={preferences.theme === theme}
            onClick={() => setTheme(theme)}
            className="rounded-full px-3 py-1 text-small capitalize text-text-secondary transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper motion-reduce:transition-none"
          >
            {theme}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={preferences.minimal}
        onClick={toggleMinimal}
        className="rounded-full border border-border-strong px-4 py-1.5 text-small transition-colors hover:bg-surface-raised motion-reduce:transition-none"
      >
        Minimal: {preferences.minimal ? "on" : "off"}
      </button>
    </div>
  );
}
