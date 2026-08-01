/**
 * CodeMirror viewport measure helpers for the Files text editor.
 *
 * CM6 measures its visible viewport from the host's client size at construction.
 * In a flex column that size is often 0 on the first effect tick; Document and
 * Markdown modes never get a later sibling-driven resize (Split does, via the
 * ReactMarkdown pane), so lines stay unpainted until click/focus remasures.
 */

/**
 * Schedule measure passes after layout has settled.
 * Double rAF covers “effect ran before flex assigned height.”
 */
export function scheduleEditorMeasure(measure: () => void): () => void {
  let cancelled = false;
  let outer = 0;
  let inner = 0;
  outer = requestAnimationFrame(() => {
    if (cancelled) return;
    measure();
    inner = requestAnimationFrame(() => {
      if (cancelled) return;
      measure();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(outer);
    cancelAnimationFrame(inner);
  };
}

/**
 * Observe host size and remasure whenever the flex/layout box changes.
 * Returns a disconnect function. No-ops when ResizeObserver is unavailable.
 */
export function observeEditorHostSize({
  host,
  measure,
}: {
  host: Element;
  measure: () => void;
}): () => void {
  if (typeof ResizeObserver === "undefined") {
    return () => {};
  }
  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => measure());
  });
  observer.observe(host);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

/**
 * Replace the document when an external value arrives that diverges from the
 * editor. Skips when equal so local typing is not clobbered.
 * Returns true when a replace was dispatched.
 */
export function syncEditorValue({
  currentDoc,
  nextValue,
  dispatch,
}: {
  currentDoc: string;
  nextValue: string;
  dispatch: (change: { from: number; to: number; insert: string }) => void;
}): boolean {
  if (currentDoc === nextValue) return false;
  dispatch({ from: 0, to: currentDoc.length, insert: nextValue });
  return true;
}
