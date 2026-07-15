"use client";

import { signOut } from "@/app/(auth)/actions";
import type { LocalSettings } from "@planevo/core/state/settings-state";
import { SettingHeading } from "./setting-heading";

export function AccountPane({
  settings,
  onChange,
}: {
  settings: LocalSettings;
  onChange: (settings: LocalSettings) => void;
}) {
  const initials =
    settings.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P";

  return (
    <div>
      <SettingHeading
        title="Account"
        description="Choose how your name appears in this browser."
      />
      <div className="mt-6 flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong bg-sidebar text-small font-medium">
          {initials}
        </div>
        <div>
          <p className="text-body font-medium">
            {settings.preferredName || settings.fullName || "Planevo user"}
          </p>
          <p className="text-small text-text-muted">Local profile</p>
        </div>
      </div>
      <div className="mt-8 max-w-xl space-y-5">
        <label className="block">
          <span className="text-small font-medium">Full name</span>
          <input
            value={settings.fullName}
            onChange={(event) =>
              onChange({ ...settings, fullName: event.target.value })
            }
            autoComplete="name"
            className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="text-small font-medium">
            What should Planevo call you?
          </span>
          <input
            value={settings.preferredName}
            onChange={(event) =>
              onChange({ ...settings, preferredName: event.target.value })
            }
            autoComplete="nickname"
            className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink"
          />
        </label>
        <p className="text-small text-text-muted">
          Changes are saved to this browser automatically.
        </p>
      </div>
      <form action={signOut} className="mt-8 border-t border-border pt-5">
        <button
          type="submit"
          className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
