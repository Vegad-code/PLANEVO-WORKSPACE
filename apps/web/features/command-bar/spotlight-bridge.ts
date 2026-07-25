type SpotlightOpenHandler = (query?: string) => void;

let handler: SpotlightOpenHandler | null = null;
let pendingQuery: string | undefined | null = null;
let hasPending = false;

/** Register the shell-owned Spotlight opener. Returns an unsubscribe. */
export function subscribeSpotlightOpen(next: SpotlightOpenHandler): () => void {
  handler = next;
  if (hasPending) {
    const query = pendingQuery ?? undefined;
    hasPending = false;
    pendingQuery = null;
    next(query);
  }
  return () => {
    if (handler === next) handler = null;
  };
}

/** Open Spotlight from anywhere (e.g. /search redirect) with an optional prefill. */
export function openSpotlight(query?: string): void {
  if (handler) {
    handler(query);
    return;
  }
  hasPending = true;
  pendingQuery = query;
}
