import type { WorkspaceShellData } from "../queries/workspace-shell";

export const LOCAL_SETTINGS_STORAGE_KEY = "planevo.settings.local.v1";

export const SETTINGS_SECTIONS = [
  "account",
  "export",
  "integrations",
  "billing",
  "appearance",
] as const;

export const INTEGRATION_IDS = [
  "gmail",
  "google-calendar",
  "google-drive",
  "canvas",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export type LocalSettings = {
  version: 1;
  fullName: string;
  preferredName: string;
  integrations: Record<IntegrationId, boolean>;
};

const DEFAULT_INTEGRATIONS: Record<IntegrationId, boolean> = {
  gmail: false,
  "google-calendar": false,
  "google-drive": false,
  canvas: false,
};

export function createDefaultLocalSettings(
  displayName: string | null,
): LocalSettings {
  const fullName = displayName?.trim() ?? "";
  const preferredName = fullName.split(/\s+/)[0] ?? "";

  return {
    version: 1,
    fullName,
    preferredName,
    integrations: { ...DEFAULT_INTEGRATIONS },
  };
}

function isIntegrationRecord(
  value: unknown,
): value is Record<IntegrationId, boolean> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return INTEGRATION_IDS.every(
    (id) => id in record && typeof record[id] === "boolean",
  );
}

export function parseLocalSettings(
  value: string | null,
  fallback: LocalSettings,
): LocalSettings {
  if (!value) return structuredClone(fallback);

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "fullName" in parsed &&
      typeof parsed.fullName === "string" &&
      "preferredName" in parsed &&
      typeof parsed.preferredName === "string" &&
      "integrations" in parsed &&
      isIntegrationRecord(parsed.integrations)
    ) {
      return {
        version: 1,
        fullName: parsed.fullName,
        preferredName: parsed.preferredName,
        integrations: { ...parsed.integrations },
      };
    }
  } catch {
    // Invalid local settings reset to the safe, versioned defaults.
  }

  return structuredClone(fallback);
}

type ExportWorkspace = {
  id: string | null;
  name: string | null;
  pages: Array<{
    id: string;
    title: string;
    depth: number;
  }>;
};

function createExportWorkspace(shell: WorkspaceShellData): ExportWorkspace {
  return {
    id: shell.workspace?.id ?? null,
    name: shell.workspace?.name ?? null,
    pages: shell.pages.map((page) => ({
      id: page.id,
      title: page.label,
      depth: page.depth,
    })),
  };
}

export function serializeWorkspaceJson(
  shell: WorkspaceShellData,
  exportedAt: Date = new Date(),
): string {
  return JSON.stringify(
    {
      format: "planevo-workspace-outline",
      version: 1,
      exportedAt: exportedAt.toISOString(),
      workspace: createExportWorkspace(shell),
    },
    null,
    2,
  );
}

export function serializeWorkspaceMarkdown(
  shell: WorkspaceShellData,
  exportedAt: Date = new Date(),
): string {
  const workspace = createExportWorkspace(shell);
  const title = workspace.name ?? "Planevo workspace";
  const pageLines = workspace.pages.map(
    (page) => `${"  ".repeat(page.depth)}- ${page.title}`,
  );

  return [
    `# ${title}`,
    "",
    `Exported ${exportedAt.toISOString()}`,
    "",
    "This file contains the workspace outline currently available in Planevo.",
    "",
    "## Pages",
    "",
    ...(pageLines.length > 0 ? pageLines : ["No pages yet."]),
    "",
  ].join("\n");
}

export function createExportFileName(
  workspaceName: string | null | undefined,
  extension: "json" | "md",
): string {
  const safeName = (workspaceName ?? "planevo-workspace")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeName || "planevo-workspace"}.${extension}`;
}
