"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import {
  createDefaultLocalSettings,
  LOCAL_SETTINGS_STORAGE_KEY,
  parseLocalSettings,
  type LocalSettings,
  type SettingsSection,
} from "@planevo/core/state/settings-state";
import { AccountPane } from "./account-pane";
import { AppearancePane } from "./appearance-pane";
import { BillingPane, type Plan } from "./billing-pane";
import { ExportPane } from "./export-pane";
import { IntegrationsPane } from "./integrations-pane";
import { WorkspaceDangerPane } from "./workspace-danger-pane";

export { BillingSummary } from "./billing-pane";
export { IntegrationRow } from "./integrations-pane";

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
      return (
        <div className="space-y-10">
          <AccountPane settings={settings} onChange={onSettingsChange} />
          {shell.workspace && (
            <WorkspaceDangerPane
              workspaceId={shell.workspace.id}
              workspaceName={shell.workspace.name}
            />
          )}
        </div>
      );
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
  initialSection = "account",
}: {
  open: boolean;
  shell: WorkspaceShellData;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
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
        key={initialSection}
        shell={shell}
        onClose={() => onOpenChange(false)}
        initialSection={initialSection}
        titleId="settings-dialog-title"
      />
    </dialog>
  );
}
