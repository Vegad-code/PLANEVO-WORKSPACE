export const FILES_SCOPE_STORAGE_KEY = "planevo:files:scope";

export type FilesScope = "all" | "workspace";

function isFilesScope(value: string | null): value is FilesScope {
  return value === "all" || value === "workspace";
}

export function getFilesScope(): FilesScope {
  if (typeof window === "undefined") return "all";

  try {
    const storedScope = window.localStorage.getItem(FILES_SCOPE_STORAGE_KEY);
    return isFilesScope(storedScope) ? storedScope : "all";
  } catch {
    return "all";
  }
}

export function setFilesScope(scope: FilesScope): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FILES_SCOPE_STORAGE_KEY, scope);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
