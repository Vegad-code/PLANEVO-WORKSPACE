import type { SettingsSection } from "@planevo/core/state/settings-state";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { SettingsPanel } from "@/features/settings/settings-dialog";

const SECTIONS: SettingsSection[] = [
  "account",
  "export",
  "integrations",
  "billing",
  "appearance",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const shell = await getWorkspaceShellData();
  const initialSection = SECTIONS.includes(section as SettingsSection)
    ? (section as SettingsSection)
    : "account";

  return (
    <div className="h-full min-h-0">
      <SettingsPanel shell={shell} initialSection={initialSection} />
    </div>
  );
}
