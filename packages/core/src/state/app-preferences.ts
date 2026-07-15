export const APP_PREFERENCES_STORAGE_KEY = "planevo.app.preferences.v1";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type AppPreferences = {
  version: 1;
  theme: ThemePreference;
  minimal: boolean;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  version: 1,
  theme: "system",
  minimal: false,
};

const THEMES = new Set<ThemePreference>(["light", "dark", "system"]);

export function parseAppPreferences(value: string | null): AppPreferences {
  if (!value) return { ...DEFAULT_APP_PREFERENCES };

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "theme" in parsed &&
      typeof parsed.theme === "string" &&
      THEMES.has(parsed.theme as ThemePreference) &&
      "minimal" in parsed &&
      typeof parsed.minimal === "boolean"
    ) {
      return {
        version: 1,
        theme: parsed.theme as ThemePreference,
        minimal: parsed.minimal,
      };
    }
  } catch {
    // Invalid persisted values reset to the safe, versioned default.
  }

  return { ...DEFAULT_APP_PREFERENCES };
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemDark
      ? "dark"
      : "light"
    : preference;
}

export function getRootAppearance(
  preferences: AppPreferences,
  systemDark: boolean,
): { theme: ResolvedTheme; minimal: boolean } {
  return {
    theme: resolveTheme(preferences.theme, systemDark),
    minimal: preferences.minimal,
  };
}

