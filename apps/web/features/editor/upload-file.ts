/**
 * Client helper: POST a File to /api/uploads and return the signed URL BlockNote expects.
 */
export async function uploadPageAsset(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Upload failed.");
  }

  return payload.url;
}

/** Resolve a stored page-asset path (or passthrough absolute URL) for display. */
export async function resolvePageAssetUrl(url: string): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }

  const response = await fetch(`/api/uploads?path=${encodeURIComponent(url)}`);
  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !payload?.url) {
    return url;
  }

  return payload.url;
}
