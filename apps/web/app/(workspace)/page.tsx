import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { getHomeData } from "@/lib/queries/home";
import { HomeCommandCenter } from "@/app/components/home-command-center";

export default async function WorkspaceCanvas() {
  const shell = await getWorkspaceShellData();
  const home = await getHomeData(shell);
  return <HomeCommandCenter data={home} />;
}
