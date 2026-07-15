"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createWorkspace, setCurrentWorkspace } from "../actions";

export async function createNamedWorkspace(formData: FormData): Promise<void> {
  const value = formData.get("name");
  const name = typeof value === "string" && value.trim() ? value.trim() : "My workspace";
  const result = await createWorkspace({ name });
  if (!result.success) throw new Error(result.error);
  await setCurrentWorkspace(result.data.workspaceId);
  revalidatePath("/", "layout");
  redirect("/");
}
