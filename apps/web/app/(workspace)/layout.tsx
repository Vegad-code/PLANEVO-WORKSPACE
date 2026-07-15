import { AppShell } from "../components/app-shell";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getWorkspaceShellData();

  return <AppShell shell={shell}>{children}</AppShell>;
}
