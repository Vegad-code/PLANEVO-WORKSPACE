import { after } from "next/server"
import { syncGoogleConnection } from "@/lib/calendar/google-calendar-sync"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 60

export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id")
  const channelToken = request.headers.get("x-goog-channel-token")
  const resourceId = request.headers.get("x-goog-resource-id")
  if (!channelId || !channelToken || !resourceId) {
    return new Response(null, { status: 400 })
  }

  const client = createAdminClient()
  const { data: connection, error } = await client
    .from("calendar_connections")
    .select("*")
    .eq("provider", "google")
    .eq("watch_channel_id", channelId)
    .eq("watch_token", channelToken)
    .eq("watch_resource_id", resourceId)
    .eq("is_enabled", true)
    .maybeSingle()
  if (error) {
    console.error("[calendar-google-webhook:lookup]", error)
    return new Response(null, { status: 500 })
  }
  if (!connection) return new Response(null, { status: 404 })

  // Google notifications contain no event body. Pull the incremental delta
  // after acknowledging the channel so webhook delivery stays fast.
  after(async () => {
    try {
      await syncGoogleConnection(client, connection)
    } catch (cause) {
      console.error(`[calendar-google-webhook:${connection.id}]`, cause)
    }
  })
  return new Response(null, { status: 204 })
}
