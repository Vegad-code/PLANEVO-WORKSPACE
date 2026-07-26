import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { after, NextResponse } from "next/server"
import {
  exchangeGoogleCalendarCode,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleCalendarOAuthOrigin,
  listGoogleCalendars,
  loadGoogleProfile,
} from "@/lib/calendar/google-calendar-api"
import { connectGoogleCalendarAccount } from "@/lib/calendar/google-calendar-connect"
import {
  renewGoogleCalendarWatch,
  syncGoogleConnection,
} from "@/lib/calendar/google-calendar-sync"
import { getDataAccess } from "@/lib/data/access"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 300

function statesMatch(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.byteLength === expectedBuffer.byteLength &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

function calendarRedirect(request: Request, status: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/calendar?google=${encodeURIComponent(status)}`, request.url),
  )
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar-connections/google/callback",
    maxAge: 0,
  })
  return response
}

export async function GET(request: Request) {
  const access = await getDataAccess()
  if (!access) return calendarRedirect(request, "auth-error")

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expectedState = (await cookies()).get(
    GOOGLE_OAUTH_STATE_COOKIE,
  )?.value
  if (url.searchParams.has("error") || !code || !statesMatch(state, expectedState)) {
    return calendarRedirect(request, "denied")
  }

  try {
    const tokens = await exchangeGoogleCalendarCode({
      code,
      origin: googleCalendarOAuthOrigin(request.url),
    })
    const [profile, providerCalendars] = await Promise.all([
      loadGoogleProfile(tokens.accessToken),
      listGoogleCalendars(tokens.accessToken),
    ])
    const adminClient = createAdminClient()
    const connections = await connectGoogleCalendarAccount(adminClient, {
      ownerId: access.ownerId,
      profile,
      tokens,
      providerCalendars,
    })
    after(async () => {
      const queue = [...connections]
      const workers = Array.from(
        { length: Math.min(4, queue.length) },
        async () => {
          while (queue.length > 0) {
            const connection = queue.shift()
            if (!connection) return
            try {
              await syncGoogleConnection(adminClient, connection)
              await renewGoogleCalendarWatch(adminClient, connection)
            } catch (cause) {
              console.error(
                `[calendar-google-connect:${connection.id}]`,
                cause,
              )
            }
          }
        }
      )
      await Promise.all(workers)
    })
    return calendarRedirect(request, "connected")
  } catch (cause) {
    console.error("[calendar-google-callback]", cause)
    return calendarRedirect(request, "error")
  }
}
