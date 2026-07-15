"use client";

import {
  INTEGRATION_IDS,
  type IntegrationId,
  type LocalSettings,
} from "@planevo/core/state/settings-state";
import { SettingHeading } from "./setting-heading";

const INTEGRATIONS: Record<
  IntegrationId,
  { name: string; description: string; monogram: string }
> = {
  gmail: {
    name: "Gmail",
    description: "Bring messages into your workspace.",
    monogram: "G",
  },
  "google-calendar": {
    name: "Google Calendar",
    description: "See events beside dated records.",
    monogram: "C",
  },
  "google-drive": {
    name: "Google Drive",
    description: "Use Drive files as workspace sources.",
    monogram: "D",
  },
  canvas: {
    name: "Canvas",
    description: "Bring courses and assignments into Planevo.",
    monogram: "C",
  },
};

export function IntegrationRow({
  id,
  connected,
  onToggle,
}: {
  id: IntegrationId;
  connected: boolean;
  onToggle?: () => void;
}) {
  const integration = INTEGRATIONS[id];

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-paper text-small font-medium">
          {integration.monogram}
        </span>
        <div className="min-w-0">
          <p className="text-body font-medium">{integration.name}</p>
          <p className="text-small text-text-secondary">
            {integration.description}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-small text-text-muted">
          {connected ? "Connected locally" : "Not connected"}
        </span>
        <button
          type="button"
          aria-pressed={connected}
          onClick={onToggle}
          className="h-9 min-w-24 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}

export function IntegrationsPane({
  settings,
  onChange,
}: {
  settings: LocalSettings;
  onChange: (settings: LocalSettings) => void;
}) {
  return (
    <div>
      <SettingHeading
        title="Integrations"
        description="Preview connection states locally. Live OAuth connections arrive with integration infrastructure."
      />
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-raised">
        {INTEGRATION_IDS.map((id, index) => (
          <div key={id}>
            {index > 0 && <div className="border-t border-border" />}
            <IntegrationRow
              id={id}
              connected={settings.integrations[id]}
              onToggle={() =>
                onChange({
                  ...settings,
                  integrations: {
                    ...settings.integrations,
                    [id]: !settings.integrations[id],
                  },
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
