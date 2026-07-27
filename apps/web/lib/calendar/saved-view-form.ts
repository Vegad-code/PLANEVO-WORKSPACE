import {
  PRESET_CONFIGS,
  resolveViewConfig,
  viewConfigSchema,
  type ViewConfig,
} from "./view-config.ts";

/** Product Calendar only creates Classic saved views. */
export const SAVED_VIEW_PRESETS = ["classic"] as const;
export type SavedViewPreset = (typeof SAVED_VIEW_PRESETS)[number];

export function isSavedViewPreset(value: string): value is SavedViewPreset {
  return SAVED_VIEW_PRESETS.includes(value as SavedViewPreset);
}

export function resolveSavedViewDraft(
  preset: SavedViewPreset,
  stored: unknown,
): ViewConfig {
  return resolveViewConfig(preset, stored);
}

/**
 * Saved views persist only the axes that differ from their preset. Keeping this
 * reduction at the form boundary means later preset refinements continue to
 * improve existing views that did not explicitly override an axis.
 */
export function viewOverridesForPreset(
  preset: SavedViewPreset,
  draft: ViewConfig,
): Partial<ViewConfig> {
  const parsed = viewConfigSchema.safeParse(draft);
  if (!parsed.success) return {};

  const base = PRESET_CONFIGS[preset];
  const overrides: Partial<ViewConfig> = {};

  for (const key of Object.keys(base) as Array<keyof ViewConfig>) {
    if (JSON.stringify(parsed.data[key]) === JSON.stringify(base[key]))
      continue;
    Object.assign(overrides, { [key]: parsed.data[key] });
  }

  return viewConfigSchema.partial().parse(overrides);
}

/** Retired planner/flow names (and anything else) degrade to Classic. */
export function presetForSavedView(value: string): SavedViewPreset {
  return isSavedViewPreset(value) ? value : "classic";
}
