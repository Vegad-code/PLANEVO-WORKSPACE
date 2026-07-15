"use client";

import { useEffect, useState } from "react";
import {
  APP_PREFERENCES_STORAGE_KEY,
  DEFAULT_APP_PREFERENCES,
  getRootAppearance,
  parseAppPreferences,
  type AppPreferences,
} from "./app-preferences";

function applyPreferences(preferences: AppPreferences, systemDark: boolean) {
  const appearance = getRootAppearance(preferences, systemDark);
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.toggleAttribute("data-minimal", appearance.minimal);
}

export function useAppPreferences() {
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

  return { preferences, updatePreferences };
}
