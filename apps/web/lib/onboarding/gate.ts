/**
 * Layout / onboarding routing helpers for F-45.
 * Spec: docs/superpowers/specs/2026-07-17-notion-workspace-fusion-design.md
 */

export function readSettingsString(
  settings: unknown,
  key: string,
): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readOrganizingAnswer(settings: unknown): string | null {
  return readSettingsString(settings, "organizing");
}

export function readGettingStartedPageId(settings: unknown): string | null {
  return readSettingsString(settings, "getting_started_page_id");
}

/**
 * True when the user should see the routing question instead of AppShell.
 * - No workspace
 * - Seeded markers missing and the workspace is still bare (0 pages)
 * Legacy workspaces with pages but no organizing stay in AppShell.
 */
export function workspaceNeedsOnboarding(input: {
  status: "ready" | "empty" | "unavailable";
  settingsJson: unknown;
  pageCount: number;
}): boolean {
  if (input.status === "empty") return true;
  if (input.status !== "ready") return false;

  const organizing = readOrganizingAnswer(input.settingsJson);
  const gettingStarted = readGettingStartedPageId(input.settingsJson);
  if (organizing || gettingStarted) return false;

  return input.pageCount === 0;
}
