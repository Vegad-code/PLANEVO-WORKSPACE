import { redirect } from "next/navigation";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import {
  readGettingStartedPageId,
  workspaceNeedsOnboarding,
} from "@/lib/onboarding/gate";
import { RoutingQuestion } from "@/features/onboarding/routing-question";

export const metadata = { title: "Get started — Planevo" };

export default async function OnboardingPage() {
  const shell = await getWorkspaceShellData();

  if (shell.status === "unavailable") redirect("/login");

  const needsOnboarding = workspaceNeedsOnboarding({
    status: shell.status,
    settingsJson: shell.workspace?.settings_json,
    pageCount: shell.pages.length,
  });

  if (!needsOnboarding) {
    const pageId = readGettingStartedPageId(shell.workspace?.settings_json);
    redirect(pageId ? `/pages/${pageId}` : "/");
  }

  return <RoutingQuestion />;
}
