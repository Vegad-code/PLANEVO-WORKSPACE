import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { IntegrationsPage } from "@/features/settings/integrations-page";

export default async function IntegrationsRoute() {
  const shell = await getWorkspaceShellData();
  return <IntegrationsPage userDisplayName={shell.userDisplayName} />;
}
