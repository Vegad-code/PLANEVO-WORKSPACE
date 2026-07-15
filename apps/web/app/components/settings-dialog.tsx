"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import type { ThemePreference } from "./app-preferences";
import { Icon, type IconName } from "./planevo-icon";
import {
  createDefaultLocalSettings,
  createExportFileName,
  INTEGRATION_IDS,
  LOCAL_SETTINGS_STORAGE_KEY,
  parseLocalSettings,
  serializeWorkspaceJson,
  serializeWorkspaceMarkdown,
  type IntegrationId,
  type LocalSettings,
  type SettingsSection,
} from "./settings-state";
import { useAppPreferences } from "./use-app-preferences";

type Plan = "free" | "plus" | "pro";

const SECTION_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  icon: IconName;
}> = [
  { id: "account", label: "Account", icon: "workspace" },
  { id: "export", label: "Export", icon: "document" },
  { id: "integrations", label: "Integrations", icon: "agents" },
  { id: "billing", label: "Billing & credits", icon: "tasks" },
  { id: "appearance", label: "Appearance", icon: "settings" },
];

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

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SettingHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-border pb-5">
      <h3 className="text-h2">{title}</h3>
      <p className="mt-1 max-w-2xl text-small text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function AccountPane({
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
    </div>
  );
}

function ExportPane({ shell }: { shell: WorkspaceShellData }) {
  const workspaceName = shell.workspace?.name;

  return (
    <div>
      <SettingHeading
        title="Export"
        description="Download the workspace outline currently available in this app shell."
      />
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface-raised">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-medium">Markdown outline</p>
            <p className="mt-1 text-small text-text-secondary">
              Page names and nesting in a readable text file.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                createExportFileName(workspaceName, "md"),
                serializeWorkspaceMarkdown(shell),
                "text/markdown",
              )
            }
            className="h-9 shrink-0 rounded-lg border border-border-strong bg-paper px-4 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Download Markdown
          </button>
        </div>
        <div className="border-t border-border" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-medium">JSON outline</p>
            <p className="mt-1 text-small text-text-secondary">
              Workspace and page metadata in a structured file.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                createExportFileName(workspaceName, "json"),
                serializeWorkspaceJson(shell),
                "application/json",
              )
            }
            className="h-9 shrink-0 rounded-lg border border-border-strong bg-paper px-4 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Download JSON
          </button>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-small text-text-muted">
        This local export does not include record values, file contents, or
        conversation history.
      </p>
    </div>
  );
}

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

function IntegrationsPane({
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

export function BillingSummary({ plan }: { plan: Plan }) {
  if (plan === "free") {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-body font-medium">Free</p>
            <p className="mt-1 text-small text-text-secondary">
              Your workspace is fully available. AI access resets on a rolling
              schedule.
            </p>
          </div>
          <span className="rounded-full border border-border-strong px-3 py-1 text-small">
            Current plan
          </span>
        </div>
      </div>
    );
  }

  const used = plan === "plus" ? 620 : 1840;
  const total = plan === "plus" ? 1500 : 5000;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-body font-medium">
            {plan === "plus" ? "Plus" : "Pro"}
          </p>
          <p className="mt-1 text-small text-text-secondary">
            AI credits reset monthly.
          </p>
        </div>
        <span className="font-mono text-mono text-text-secondary">
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={`${plan} credit use`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
      >
        <div
          className={plan === "plus" ? "h-full w-2/5 bg-ink" : "h-full w-1/3 bg-ink"}
        />
      </div>
    </div>
  );
}

function BillingPane({ plan }: { plan: Plan }) {
  return (
    <div>
      <SettingHeading
        title="Billing & credits"
        description="Your workspace stays complete on every plan. Paid plans add AI capacity."
      />
      <div className="mt-6">
        <BillingSummary plan={plan} />
      </div>
    </div>
  );
}

function AppearancePane() {
  const { preferences, updatePreferences } = useAppPreferences();

  function setTheme(theme: ThemePreference) {
    updatePreferences({ ...preferences, theme });
  }

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
          <div
            className="flex rounded-full border border-border bg-paper p-1"
            aria-label="Theme preference"
          >
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={preferences.theme === theme}
                onClick={() => setTheme(theme)}
                className="rounded-full px-3 py-1 text-small capitalize text-text-secondary outline-none transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border" />
        <div className="flex items-center justify-between gap-5 p-5">
          <div>
            <p className="text-body font-medium">Minimal mode</p>
            <p className="mt-1 text-small text-text-secondary">
              Mute status colors while preserving hierarchy.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.minimal}
            aria-label="Minimal mode"
            onClick={() =>
              updatePreferences({
                ...preferences,
                minimal: !preferences.minimal,
              })
            }
            className="relative h-6 w-11 shrink-0 rounded-full border border-border-strong bg-border outline-none transition-colors aria-checked:bg-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-paper transition-transform motion-reduce:transition-none ${
                preferences.minimal ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPane({
  section,
  shell,
  settings,
  plan,
  onSettingsChange,
}: {
  section: SettingsSection;
  shell: WorkspaceShellData;
  settings: LocalSettings;
  plan: Plan;
  onSettingsChange: (settings: LocalSettings) => void;
}) {
  switch (section) {
    case "account":
      return <AccountPane settings={settings} onChange={onSettingsChange} />;
    case "export":
      return <ExportPane shell={shell} />;
    case "integrations":
      return (
        <IntegrationsPane settings={settings} onChange={onSettingsChange} />
      );
    case "billing":
      return <BillingPane plan={plan} />;
    case "appearance":
      return <AppearancePane />;
    default: {
      const exhaustiveCheck: never = section;
      return exhaustiveCheck;
    }
  }
}

export function SettingsPanel({
  shell,
  onClose,
  plan = "free",
  initialSection = "account",
  titleId,
}: {
  shell: WorkspaceShellData;
  onClose?: () => void;
  plan?: Plan;
  initialSection?: SettingsSection;
  titleId?: string;
}) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const defaults = useMemo(
    () => createDefaultLocalSettings(shell.userDisplayName),
    [shell.userDisplayName],
  );
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const [settings, setSettings] = useState<LocalSettings>(defaults);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setSettings(
        parseLocalSettings(
          localStorage.getItem(LOCAL_SETTINGS_STORAGE_KEY),
          defaults,
        ),
      );
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [defaults]);

  function updateSettings(next: LocalSettings) {
    setSettings(next);
    localStorage.setItem(LOCAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }

  const visibleSections = SECTION_ITEMS.filter((section) =>
    section.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper text-ink md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-sidebar p-3 md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-10 items-center justify-between px-2">
          <h2 id={resolvedTitleId} className="text-h3">
            Settings
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="flex size-8 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <label className="relative mt-2 block">
          <span className="sr-only">Search settings</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            className="h-9 w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 text-small outline-none placeholder:text-text-muted focus:border-border-strong"
          />
        </label>
        <nav
          aria-label="Settings sections"
          className="mt-3 flex gap-1 overflow-x-auto md:block md:space-y-0.5"
        >
          {visibleSections.map((section) => {
            const active = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveSection(section.id)}
                className={`flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none md:w-full ${
                  active
                    ? "bg-surface-raised text-ink"
                    : "text-text-secondary hover:bg-surface-raised hover:text-ink"
                }`}
              >
                <Icon name={section.icon} className="size-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>
        {visibleSections.length === 0 && (
          <p className="px-3 py-4 text-small text-text-muted">
            No settings found.
          </p>
        )}
      </aside>
      <section
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8"
      >
        <SettingsPane
          section={activeSection}
          shell={shell}
          settings={settings}
          plan={plan}
          onSettingsChange={updateSettings}
        />
      </section>
    </div>
  );
}

export function SettingsDialog({
  open,
  shell,
  onOpenChange,
}: {
  open: boolean;
  shell: WorkspaceShellData;
  onOpenChange: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onOpenChange(false);
      }}
      className="m-auto h-dvh max-h-dvh w-screen max-w-none overflow-hidden rounded-none border border-border bg-paper p-0 text-ink backdrop:bg-ink/30 md:h-3/4 md:w-full md:max-w-5xl md:rounded-card"
    >
      <SettingsPanel
        shell={shell}
        onClose={() => onOpenChange(false)}
        titleId="settings-dialog-title"
      />
    </dialog>
  );
}
