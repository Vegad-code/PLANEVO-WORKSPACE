import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import {
  buildGoogleCalendarAuthorizationUrl,
  googleCalendarOAuthOrigin,
  GOOGLE_OAUTH_STATE_COOKIE,
} from "@/lib/calendar/google-calendar-api"
import { getDataAccess } from "@/lib/data/access"

export async function GET(request: Request) {
  const access = await getDataAccess()
  if (!access) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    const state = randomBytes(32).toString("base64url")
    const response = NextResponse.redirect(
      buildGoogleCalendarAuthorizationUrl({
        origin: googleCalendarOAuthOrigin(request.url),
        state,
      }),
    )
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/calendar-connections/google/callback",
      maxAge: 10 * 60,
    })
    return response
  } catch {
    return NextResponse.redirect(
      new URL("/calendar?google=configuration-error", request.url),
    )
  }
}
