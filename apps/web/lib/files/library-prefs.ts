export const FILES_LIBRARY_WIDTH_KEY = "planevo:files:library-width";
export const FILES_LIBRARY_COLLAPSED_KEY = "planevo:files:library-collapsed";
/** Readable by Server Components (`loading.tsx`) so hard-refresh HTML matches. */
export const FILES_LIBRARY_COLLAPSED_COOKIE = "planevo_files_library_collapsed";
export const MIN_LIBRARY_WIDTH = 220;
export const MAX_LIBRARY_WIDTH = 400;
export const DEFAULT_LIBRARY_WIDTH = 288;
/** Open by default when the user has never chosen. */
export const DEFAULT_LIBRARY_COLLAPSED = false;

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

export function getLibraryCollapsed(): boolean {
  if (typeof window === "undefined") return DEFAULT_LIBRARY_COLLAPSED;

  try {
    const stored = window.localStorage.getItem(FILES_LIBRARY_COLLAPSED_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return DEFAULT_LIBRARY_COLLAPSED;
  } catch {
    return DEFAULT_LIBRARY_COLLAPSED;
  }
}

export function setLibraryCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      FILES_LIBRARY_COLLAPSED_KEY,
      collapsed ? "true" : "false",
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  try {
    // Mirror into a cookie so `/files` loading SSR can render width 0 (localStorage
    // is invisible to Server Components — that was the hard-refresh Library flash).
    document.cookie = `${FILES_LIBRARY_COLLAPSED_COOKIE}=${collapsed ? "true" : "false"};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // Cookies can be blocked; boot script + client restore remain as fallback.
  }
}

/**
 * Runs before hydration. Sets --library-rail-width to 0 when collapsed so the
 * rail cannot paint open from SSR defaults before React restores prefs.
 */
export const LIBRARY_RAIL_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(FILES_LIBRARY_COLLAPSED_KEY)});var w=localStorage.getItem(${JSON.stringify(FILES_LIBRARY_WIDTH_KEY)});var r=document.documentElement;var collapsed=c==="true";r.dataset.libraryCollapsed=collapsed?"true":"false";var n=w==null?NaN:parseInt(w,10);if(!Number.isFinite(n))n=${DEFAULT_LIBRARY_WIDTH};n=Math.min(${MAX_LIBRARY_WIDTH},Math.max(${MIN_LIBRARY_WIDTH},Math.round(n)));r.style.setProperty("--library-rail-width",(collapsed?0:n)+"px");}catch(e){}})();`;
