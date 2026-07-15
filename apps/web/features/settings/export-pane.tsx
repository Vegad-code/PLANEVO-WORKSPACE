"use client";

import type { WorkspaceShellData } from "@planevo/core/queries/workspace-shell";
import {
  createExportFileName,
  serializeWorkspaceJson,
  serializeWorkspaceMarkdown,
} from "@planevo/core/state/settings-state";
import { SettingHeading } from "./setting-heading";

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

export function ExportPane({ shell }: { shell: WorkspaceShellData }) {
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
