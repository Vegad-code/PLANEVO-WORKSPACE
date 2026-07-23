import { NextResponse } from "next/server";
import { StorageQuotaError } from "@/lib/files/storage-quota.server";
import { RateLimitError } from "@/lib/security/rate-limit.server";

/**
 * Map the typed errors shared across API routes to their HTTP responses.
 * Returns null for anything unrecognized so each route keeps its own
 * auth/500 fallback handling.
 */
export function mapTypedError(cause: unknown): NextResponse | null {
  if (cause instanceof RateLimitError) {
    return NextResponse.json(
      { error: cause.message },
      { status: 429, headers: { "retry-after": String(cause.retryAfterSeconds) } },
    );
  }
  if (cause instanceof StorageQuotaError) {
    return NextResponse.json({ error: cause.message }, { status: 413 });
  }
  return null;
}
