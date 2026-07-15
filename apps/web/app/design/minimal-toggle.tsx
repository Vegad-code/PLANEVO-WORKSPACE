"use client";

import {
  type ThemePreference,
} from "../components/app-preferences";
import { useAppPreferences } from "../components/use-app-preferences";

export function MinimalToggle() {
  const { preferences, updatePreferences } = useAppPreferences();

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
