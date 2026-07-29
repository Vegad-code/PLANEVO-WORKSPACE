"use client";

import type { ThemePreference } from "@planevo/core/state/app-preferences";
import { Switch } from "@/components/ui/switch";
import { useAppPreferences } from "@/features/settings/use-app-preferences";

/** Pill group for light / dark / system. The one theme control in the app. */
export function ThemeButtonGroup() {
  const { preferences, updatePreferences } = useAppPreferences();

  return (
    <div
      className="flex rounded-full border border-border bg-paper p-1"
      aria-label="Theme preference"
    >
      {(["light", "dark", "system"] as const).map((theme: ThemePreference) => (
        <button
          key={theme}
          type="button"
          aria-pressed={preferences.theme === theme}
          onClick={() => updatePreferences({ ...preferences, theme })}
          className="rounded-full px-3 py-1 text-small capitalize text-text-secondary outline-none transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          {theme}
        </button>
      ))}
    </div>
  );
}

/** Switch for minimal mode (mutes accent tokens; design-brief §1). */
export function MinimalModeSwitch() {
  const { preferences, updatePreferences } = useAppPreferences();

  return (
    <Switch
      checked={preferences.minimal}
      onCheckedChange={(minimal) => updatePreferences({ ...preferences, minimal })}
      aria-label="Minimal mode"
    />
  );
}
