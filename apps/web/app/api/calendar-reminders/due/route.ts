import { NextResponse } from "next/server"
import { dueBrowserReminder } from "@/lib/calendar/browser-reminder"
import { getDataAccess } from "@/lib/data/access"

export async function GET() {
  const access = await getDataAccess()
  if (!access) {
    return NextResponse.json({ reminders: [] }, { status: 401 })
  }

  const now = new Date()
  const { data: reminders, error } = await access.client.rpc(
    "get_due_browser_reminders",
    {
      p_owner_id: access.ownerId,
      p_now: now.toISOString(),
    },
  )
  if (error) throw error
  const due = (reminders ?? []).flatMap((reminder) => {
    const notification = dueBrowserReminder(
      {
        reminderId: reminder.reminder_id,
        eventId: reminder.event_id,
        title: reminder.title,
        startsAt: reminder.starts_at,
        offsetMinutes: reminder.offset_minutes,
        location: reminder.location,
      },
      { now },
    )
    return notification ? [notification] : []
  })

  return NextResponse.json(
    { reminders: due },
    { headers: { "Cache-Control": "no-store" } },
  )
}
