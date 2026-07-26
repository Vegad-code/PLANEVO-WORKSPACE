import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@planevo/core/types/database.types"
import {
  CALENDAR_COLORS,
  type CalendarColor,
} from "@planevo/core/types/calendar"
import {
  calendarTokenEncryptionKey,
  sealCalendarToken,
} from "./calendar-token-crypto.ts"
import type {
  GoogleCalendarListEntry,
  GoogleOAuthTokens,
  GoogleProfile,
} from "./google-calendar-api.ts"
import type { GoogleCalendarConnection } from "./google-calendar-sync.ts"

type CalendarAccount =
  Database["public"]["Tables"]["calendar_accounts"]["Row"]

function connectionColor(index: number): CalendarColor {
  return CALENDAR_COLORS[index % CALENDAR_COLORS.length] ?? "slate"
}

async function persistGoogleAccount(
  client: SupabaseClient<Database>,
  {
    ownerId,
    profile,
    tokens,
    now,
  }: {
    ownerId: string
    profile: GoogleProfile
    tokens: GoogleOAuthTokens
    now: Date
  },
): Promise<CalendarAccount> {
  const { data: existing, error: existingError } = await client
    .from("calendar_accounts")
    .select("*")
    .eq("user_id", ownerId)
    .eq("provider", "google")
    .eq("provider_account_id", profile.id)
    .maybeSingle()
  if (existingError) throw existingError
  if (!tokens.refreshToken && !existing) {
    throw new Error("Google did not provide offline calendar access.")
  }

  const key = calendarTokenEncryptionKey()
  const patch = {
    display_name: profile.name?.trim() || profile.email,
    access_token_ciphertext: sealCalendarToken(tokens.accessToken, key),
    refresh_token_ciphertext: tokens.refreshToken
      ? sealCalendarToken(tokens.refreshToken, key)
      : existing!.refresh_token_ciphertext,
    token_expires_at: new Date(
      now.getTime() + tokens.expiresInSeconds * 1_000,
    ).toISOString(),
    scopes: tokens.scopes,
    revoked_at: null,
    updated_at: now.toISOString(),
  }

  if (existing) {
    const { data, error } = await client
      .from("calendar_accounts")
      .update(patch)
      .eq("id", existing.id)
      .eq("user_id", ownerId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await client
    .from("calendar_accounts")
    .insert({
      user_id: ownerId,
      provider: "google",
      provider_account_id: profile.id,
      ...patch,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

async function createGoogleConnection(
  client: SupabaseClient<Database>,
  {
    ownerId,
    accountId,
    providerCalendar,
    color,
    position,
    makeDefault,
  }: {
    ownerId: string
    accountId: string
    providerCalendar: GoogleCalendarListEntry
    color: CalendarColor
    position: number
    makeDefault: boolean
  },
): Promise<GoogleCalendarConnection> {
  const name = providerCalendar.summary.trim().slice(0, 120) || "Google Calendar"
  const { data: calendar, error: calendarError } = await client
    .from("calendars")
    .insert({
      user_id: ownerId,
      name,
      color,
      is_visible: true,
      is_default: makeDefault,
      position,
    })
    .select()
    .single()
  if (calendarError) throw calendarError

  const { data: connection, error: connectionError } = await client
    .from("calendar_connections")
    .insert({
      user_id: ownerId,
      calendar_id: calendar.id,
      account_id: accountId,
      provider: "google",
      provider_calendar_id: providerCalendar.id,
      metadata_json: {
        primary: providerCalendar.primary === true,
        access_role: providerCalendar.accessRole ?? null,
      } satisfies Json,
    })
    .select()
    .single()
  if (connectionError) {
    await client
      .from("calendars")
      .delete()
      .eq("id", calendar.id)
      .eq("user_id", ownerId)
    throw connectionError
  }
  return connection
}

/**
 * Idempotently persists the Google account and one read-only Planevo calendar
 * per provider calendar. Reconnects keep user-renamed calendars intact.
 */
export async function connectGoogleCalendarAccount(
  client: SupabaseClient<Database>,
  {
    ownerId,
    profile,
    tokens,
    providerCalendars,
    now = new Date(),
  }: {
    ownerId: string
    profile: GoogleProfile
    tokens: GoogleOAuthTokens
    providerCalendars: GoogleCalendarListEntry[]
    now?: Date
  },
): Promise<GoogleCalendarConnection[]> {
  const account = await persistGoogleAccount(client, {
    ownerId,
    profile,
    tokens,
    now,
  })
  const { data: defaultCalendar, error: defaultError } = await client
    .from("calendars")
    .select("id")
    .eq("user_id", ownerId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle()
  if (defaultError) throw defaultError

  const connections: GoogleCalendarConnection[] = []
  let assignedDefault = Boolean(defaultCalendar)
  for (const [index, providerCalendar] of providerCalendars
    .slice(0, 50)
    .entries()) {
    const { data: existing, error } = await client
      .from("calendar_connections")
      .select("*")
      .eq("user_id", ownerId)
      .eq("account_id", account.id)
      .eq("provider", "google")
      .eq("provider_calendar_id", providerCalendar.id)
      .maybeSingle()
    if (error) throw error
    if (existing) {
      if (!existing.is_enabled) {
        const { data: enabled, error: enableError } = await client
          .from("calendar_connections")
          .update({ is_enabled: true, updated_at: now.toISOString() })
          .eq("id", existing.id)
          .eq("user_id", ownerId)
          .select()
          .single()
        if (enableError) throw enableError
        connections.push(enabled)
      } else {
        connections.push(existing)
      }
      continue
    }

    const makeDefault = !assignedDefault
    const connection = await createGoogleConnection(client, {
      ownerId,
      accountId: account.id,
      providerCalendar,
      color: connectionColor(index),
      position: now.getTime() + index,
      makeDefault,
    })
    connections.push(connection)
    assignedDefault ||= makeDefault
  }
  return connections
}
