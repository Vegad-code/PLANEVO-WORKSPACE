export const FILES_PREVIEW_WIDTH_KEY = "planevo:files:preview-width";
export const MIN_PREVIEW_WIDTH = 320;
export const MAX_PREVIEW_WIDTH = 760;
export const DEFAULT_PREVIEW_WIDTH = 440;

function clampWidth(px: number): number {
  return Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, px));
}

export function getPreviewWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PREVIEW_WIDTH;

  try {
    const stored = window.localStorage.getItem(FILES_PREVIEW_WIDTH_KEY);
    const parsed = stored === null ? NaN : Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_PREVIEW_WIDTH;
  } catch {
    return DEFAULT_PREVIEW_WIDTH;
  }
}

export function setPreviewWidth(px: number): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FILES_PREVIEW_WIDTH_KEY, String(clampWidth(px)));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
