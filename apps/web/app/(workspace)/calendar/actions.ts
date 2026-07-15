"use server";

import { revalidatePath } from "next/cache";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createCalendarDatabaseWithViews, createWorkspace } from "../actions";

export async function createWorkspaceCalendar(): Promise<void> {
  // Resolved server-side — a client-supplied workspace id is never trusted.
  const current = await getCurrentWorkspace();
  let workspaceId = current?.workspace.id;

  if (!workspaceId) {
    const workspace = await createWorkspace({ name: "My workspace" });
    if (!workspace.success) throw new Error(workspace.error);
    workspaceId = workspace.data.workspaceId;
  }

  const calendar = await createCalendarDatabaseWithViews({
    workspaceId,
    name: "Calendar",
  });
  if (!calendar.success) throw new Error(calendar.error);

  revalidatePath("/calendar");
  revalidatePath("/", "layout");
}
