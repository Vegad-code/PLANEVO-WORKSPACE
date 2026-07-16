"use client";

import { deleteWorkspace } from "@/app/(workspace)/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { SettingHeading } from "./setting-heading";

export function WorkspaceDangerPane({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  return (
    <div>
      <SettingHeading
        title="Delete workspace"
        description="Permanently remove this workspace and everything inside it — pages, databases, files, and conversations."
      />
      <div className="mt-6 max-w-xl rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body text-text-secondary">
          This action is irreversible. All records, uploads, and pages in{" "}
          <span className="font-medium text-ink">{workspaceName}</span> will be deleted from the
          database.
        </p>
        <div className="mt-4">
          <DeleteEntityControl
            label="Delete workspace"
            title={`Delete “${workspaceName}”?`}
            description="Every page, database, record, file, and conversation in this workspace will be permanently removed. Storage uploads will be deleted too."
            confirmLabel="Delete workspace"
            confirmationPhrase={workspaceName}
            onConfirm={(typedConfirmation) =>
              deleteWorkspace({
                workspaceId,
                confirmationName: typedConfirmation ?? "",
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
