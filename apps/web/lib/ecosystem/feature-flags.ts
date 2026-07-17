/**
 * Ecosystem v2 feature flag.
 *
 * Phase 1: env-only. Server-side check of PLANEVO_ECOSYSTEM_V2. The plan also
 * calls for a `user_preferences.settings_json.ecosystem_v2` override, but no
 * DB fetch belongs in this helper — callers that have already loaded
 * settings can pass them in via `settings`.
 *
 * ponytail: settings-based override not wired to a DB fetch yet; add a
 * caller-side fetch + pass-through when per-user opt-in ships.
 */
export function isEcosystemV2Enabled(settings?: { ecosystem_v2?: boolean }): boolean {
  if (settings?.ecosystem_v2 !== undefined) return settings.ecosystem_v2;
  return process.env.PLANEVO_ECOSYSTEM_V2 === "true";
}
