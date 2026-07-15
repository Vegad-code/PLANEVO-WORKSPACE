"use server";

import { revalidatePath } from "next/cache";
import {
  createCalendarDatabaseWithViews,
  createWorkspace,
} from "../actions";

export async function createWorkspaceCalendar(formData: FormData): Promise<void> {
  let workspaceId = String(formData.get("workspaceId") ?? "").trim();

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
