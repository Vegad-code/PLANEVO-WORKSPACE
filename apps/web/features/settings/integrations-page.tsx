"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDefaultLocalSettings,
  LOCAL_SETTINGS_STORAGE_KEY,
  parseLocalSettings,
  type LocalSettings,
} from "@planevo/core/state/settings-state";
import { IntegrationsPane } from "./integrations-pane";

export function IntegrationsPage({
  userDisplayName,
}: {
  userDisplayName: string | null;
}) {
  const defaults = useMemo(
    () => createDefaultLocalSettings(userDisplayName),
    [userDisplayName],
  );
  const [settings, setSettings] = useState<LocalSettings>(defaults);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(
        parseLocalSettings(localStorage.getItem(LOCAL_SETTINGS_STORAGE_KEY), defaults),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaults]);

  function updateSettings(next: LocalSettings) {
    setSettings(next);
    localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <IntegrationsPane settings={settings} onChange={updateSettings} />
    </div>
  );
}
