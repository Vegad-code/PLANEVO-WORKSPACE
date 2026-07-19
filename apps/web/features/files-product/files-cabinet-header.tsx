import type { FilesScope } from "@/lib/files/scope-prefs";

type FilesCabinetHeaderProps = {
  firstName: string | null;
  scope: FilesScope;
};

export function FilesCabinetHeader({ firstName, scope }: FilesCabinetHeaderProps) {
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  return (
    <div>
      <p className="text-product-meta text-text-muted">
        {scope === "workspace" ? "This workspace" : "All files"}
      </p>
      <h1
        id="files-product-title"
        className="mt-1 text-h1 font-medium tracking-tight"
      >
        {greeting}
      </h1>
      <p className="mt-1 text-body text-text-secondary">
        Pick up where you left off in your file cabinet.
      </p>
    </div>
  );
}
