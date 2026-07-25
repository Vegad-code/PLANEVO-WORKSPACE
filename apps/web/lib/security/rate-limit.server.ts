import "server-only";

import type { DataAccess } from "@/lib/data/access";

/** Thrown when a caller exceeds a route's request budget (→ 429). */
export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many requests. Slow down and try again in a moment.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Per-user, per-minute defaults. Mint/upload routes are tighter than reads. */
export const RATE_LIMITS = {
  upload: { limit: 60, windowSeconds: 60 },
  mutate: { limit: 120, windowSeconds: 60 },
  read: { limit: 240, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window rate limit keyed by (user, routeKey). Throws RateLimitError when
 * the caller is over budget for the current window.
 *
 * ponytail: fails OPEN on limiter faults — a rate-limit outage must not take
 * uploads down with it; the limiter is defense-in-depth, not the auth boundary.
 */
export async function enforceRateLimit(
  access: DataAccess,
  routeKey: string,
  rule: RateLimitRule,
): Promise<void> {
  const { data, error } = await access.client.rpc("check_rate_limit", {
    p_owner_id: access.ownerId,
    p_route_key: routeKey,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed, allowing request", error);
    return;
  }
  if (data === false) {
    throw new RateLimitError(rule.windowSeconds);
  }
}
