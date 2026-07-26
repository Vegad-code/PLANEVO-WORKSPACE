import { NextResponse } from "next/server"
import { loadCalendarView } from "@planevo/core/queries/product-calendar"
import { z } from "zod"
import { embeddedCalendarRequest } from "@/lib/calendar/embedded-calendar"
import {
  fetchCalendarPageData,
  serializeCalendarQueryData,
} from "@/lib/calendar/fetch-calendar-page-data"
import { mapTypedError } from "@/lib/api/typed-errors"
import { getDataAccess } from "@/lib/data/access"
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server"

const viewIdSchema = z.string().uuid()
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const viewId = new URL(request.url).searchParams.get("viewId")
  const parsedViewId = viewIdSchema.safeParse(viewId)
  if (!parsedViewId.success) {
    return NextResponse.json(
      { error: "A valid calendar view is required." },
      { status: 400, headers: NO_STORE_HEADERS },
    )
  }

  const access = await getDataAccess()
  if (!access) {
    return NextResponse.json(
      { error: "Sign in to see this calendar." },
      { status: 401, headers: NO_STORE_HEADERS },
    )
  }

  try {
    await enforceRateLimit(access, "embedded-calendar:get", RATE_LIMITS.read)
    const view = await loadCalendarView(
      access.client,
      access.ownerId,
      parsedViewId.data,
    )
    if (!view) {
      return NextResponse.json(
        { error: "Calendar view not found." },
        { status: 404, headers: NO_STORE_HEADERS },
      )
    }

    const ready = await fetchCalendarPageData(
      access,
      null,
      "all",
      embeddedCalendarRequest(view, new Date()),
    )

    return NextResponse.json(
      {
        view,
        data: serializeCalendarQueryData(ready),
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (cause) {
    const mapped = mapTypedError(cause)
    if (mapped) return mapped
    return NextResponse.json(
      { error: "Failed to load embedded calendar." },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
