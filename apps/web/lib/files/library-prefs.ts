export const FILES_LIBRARY_WIDTH_KEY = "planevo:files:library-width";
export const MIN_LIBRARY_WIDTH = 220;
export const MAX_LIBRARY_WIDTH = 400;
export const DEFAULT_LIBRARY_WIDTH = 288;

export function clampLibraryWidth(px: number): number {
  return Math.min(MAX_LIBRARY_WIDTH, Math.max(MIN_LIBRARY_WIDTH, Math.round(px)));
}

export function getLibraryWidth(): number {
  if (typeof window === "undefined") return DEFAULT_LIBRARY_WIDTH;

  try {
    const stored = window.localStorage.getItem(FILES_LIBRARY_WIDTH_KEY);
    const parsed = stored === null ? NaN : Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? clampLibraryWidth(parsed) : DEFAULT_LIBRARY_WIDTH;
  } catch {
    return DEFAULT_LIBRARY_WIDTH;
  }
}

export function setLibraryWidth(px: number): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      FILES_LIBRARY_WIDTH_KEY,
      String(clampLibraryWidth(px)),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
