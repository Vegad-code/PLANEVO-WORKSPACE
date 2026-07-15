"use client";

import { MinimalModeSwitch, ThemeButtonGroup } from "@/components/ui/theme-controls";
import { SettingHeading } from "./setting-heading";

export function AppearancePane() {
  return (
    <div>
      <SettingHeading
        title="Appearance"
        description="Choose how Planevo looks on this device."
      />
      <div className="mt-6 max-w-2xl overflow-hidden rounded-xl border border-border bg-surface-raised">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-medium">Theme</p>
            <p className="mt-1 text-small text-text-secondary">
              Follow your system or choose a fixed appearance.
            </p>
          </div>
          <ThemeButtonGroup />
        </div>
        <div className="border-t border-border" />
        <div className="flex items-center justify-between gap-5 p-5">
          <div>
            <p className="text-body font-medium">Minimal mode</p>
            <p className="mt-1 text-small text-text-secondary">
              Mute status colors while preserving hierarchy.
            </p>
          </div>
          <MinimalModeSwitch />
        </div>
      </div>
    </div>
  );
}
