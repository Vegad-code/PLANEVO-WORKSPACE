"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireMutationDataAccess } from "@/lib/data/access";
import { WORKSPACE_COOKIE } from "@/lib/data/current-workspace";
import { workspaceNeedsOnboarding } from "@/lib/onboarding/gate";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { isOrganizingAnswer } from "@planevo/core/defaults/starter-workspaces";
import { createStarterWorkspace } from "@planevo/core/mutations/create-starter-workspace";
import { createUserProducts } from "@planevo/core/mutations/create-user-products";

export async function completeOnboardingRouting(organizing: string): Promise<void> {
  if (!isOrganizingAnswer(organizing)) {
    throw new Error("Please choose one of the options to continue.");
  }

  const shell = await getWorkspaceShellData();
  if (shell.status === "unavailable") redirect("/login");

  const needsOnboarding = workspaceNeedsOnboarding({
    status: shell.status,
    settingsJson: shell.workspace?.settings_json,
    pageCount: shell.pages.length,
  });
  if (!needsOnboarding) redirect("/");

  const access = await requireMutationDataAccess();
  await createUserProducts(access.client, {
    userId: access.ownerId,
    organizing,
  });
  const result = await createStarterWorkspace(access.client, access.ownerId, {
    organizing,
    displayName: shell.userDisplayName,
    // Reuse a bare empty workspace so onboarding does not orphan a prior create.
    workspaceId:
      shell.status === "ready" && shell.pages.length === 0
        ? shell.workspace?.id
        : null,
  });

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, result.workspaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  redirect(`/pages/${result.gettingStartedPageId}`);
}
