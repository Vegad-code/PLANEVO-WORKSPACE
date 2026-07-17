import type { CommandIndexEntry } from "@planevo/core/search/command-model";

let cachedEntries: CommandIndexEntry[] | null = null;
let inflight: Promise<CommandIndexEntry[]> | null = null;
let staleOnNextOpen = true;

export function markCommandIndexStale(): void {
  staleOnNextOpen = true;
}

export function fetchCommandIndex(): Promise<CommandIndexEntry[]> {
  if (!staleOnNextOpen && cachedEntries) {
    return Promise.resolve(cachedEntries);
  }

  if (!inflight) {
    inflight = fetch("/api/command-index")
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Failed to load command index.");
        }
        return response.json() as Promise<CommandIndexEntry[]>;
      })
      .then((entries) => {
        cachedEntries = entries;
        staleOnNextOpen = false;
        inflight = null;
        return entries;
      })
      .catch((cause) => {
        inflight = null;
        throw cause;
      });
  }

  return inflight;
}
