import { redirect } from "next/navigation";
import { AppShell } from "@/features/shell/app-shell";
import { Toaster } from "@/components/ui/toast";
import { workspaceNeedsOnboarding } from "@/lib/onboarding/gate";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { CalendarReminderProvider } from "@/features/calendar-product/calendar-reminder-provider";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getWorkspaceShellData();

  if (shell.status === "unavailable") redirect("/login");
  if (
    workspaceNeedsOnboarding({
      status: shell.status,
      settingsJson: shell.workspace?.settings_json,
      pageCount: shell.pages.length,
    })
  ) {
    redirect("/onboarding");
  }

  return (
    <>
      <CalendarReminderProvider />
      <AppShell shell={shell}>{children}</AppShell>
      <Toaster />
    </>
  );
}
