/**
 * Centralized Supabase env access.
 *
 * Public keys (URL + publishable/anon) may use NEXT_PUBLIC_ — they are designed
 * for the browser and are constrained by RLS.
 *
 * Secret keys (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY) must NEVER use
 * the NEXT_PUBLIC_ prefix. They bypass RLS and are server-only.
 */

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function decodeJwtPayload(segment: string): { role?: string } | null {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as { role?: string };
  } catch {
    return null;
  }
}

function looksLikeServiceRoleJwt(key: string): boolean {
  // Legacy JWTs encode role in the payload; never treat service_role as public.
  const parts = key.split(".");
  if (parts.length < 2) return false;
  const payload = decodeJwtPayload(parts[1]!);
  return payload?.role === "service_role";
}

function looksLikeSecretKey(key: string): boolean {
  return key.startsWith("sb_secret_") || looksLikeServiceRoleJwt(key);
}

export function getSupabaseUrl(): string {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in environment.");
  }
  return url;
}

/** Browser / user-scoped clients: publishable first, then legacy anon. */
export function getSupabasePublicKey(): string {
  const key =
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!key) {
    throw new Error(
      "Missing public Supabase key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  if (looksLikeSecretKey(key)) {
    throw new Error(
      "A server secret key was configured as a NEXT_PUBLIC_ public key. Move it to SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return key;
}

/** Admin / seed clients only: new secret first, then legacy service_role. */
export function getSupabaseServerSecretKey(): string {
  // Hard guard: never read a NEXT_PUBLIC_ secret — that would mean it was exposed.
  if (
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
  ) {
    throw new Error(
      "Server secret keys must not use the NEXT_PUBLIC_ prefix. Rename to SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const key =
    trimEnv(process.env.SUPABASE_SECRET_KEY) ??
    trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!key) {
    throw new Error(
      "Missing server secret key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return key;
}

export function hasSupabaseServerSecretKey(): boolean {
  try {
    getSupabaseServerSecretKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Auth Admin API (`auth.admin.*`) is most reliable with the legacy service_role
 * JWT. New `sb_secret_*` keys can intermittently return `bad_jwt` under load.
 */
export function getSupabaseAuthAdminKey(): string {
  const serviceRole = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (serviceRole && looksLikeServiceRoleJwt(serviceRole)) {
    return serviceRole;
  }
  return getSupabaseServerSecretKey();
}

export function getSupabasePublicConfig(): { url: string; key: string } {
  return {
    url: getSupabaseUrl(),
    key: getSupabasePublicKey(),
  };
}
