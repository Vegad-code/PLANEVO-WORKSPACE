import { DatabaseFace } from "@/features/shell/database-face";
import { RecreateDatabaseButton } from "@/features/shell/recreate-database-button";
import { getCalendarFaceBundle } from "@/lib/queries/face-databases";
import { createWorkspaceCalendar } from "./actions";

export default async function CalendarPage() {
  const { workspaceId, bundle } = await getCalendarFaceBundle();

  return (
    <DatabaseFace
      eyebrow="Workspace database"
      title="Calendar"
      description="Events and dated records from your calendar database."
      bundle={bundle}
      workspaceId={workspaceId}
      unavailable={{
        icon: "calendar",
        title: "Sign in to see your calendar",
        description: "Your calendar database appears here once you're signed in.",
      }}
      empty={{
        icon: "calendar",
        title: "Your calendar is ready when you are",
        description:
          "Create a calendar database with list and table views. Dated records show on the grid.",
        recreate: (
          <RecreateDatabaseButton
            label="Create calendar database"
            onRecreate={createWorkspaceCalendar}
          />
        ),
      }}
    />
  );
}
