"use client"

import { useMemo } from "react"
import { formatGmtOffsetLabel } from "@/lib/calendar/calendar-timezone"

export function RbcTimeGutterHeader() {
  const label = useMemo(() => formatGmtOffsetLabel(), [])

  return (
    <span
      className="planevo-rbc-timezone-label"
      title={label}
      aria-label={`Timezone ${label}`}
    >
      {label}
    </span>
  )
}
