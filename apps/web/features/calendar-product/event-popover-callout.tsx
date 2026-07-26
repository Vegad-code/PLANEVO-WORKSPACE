"use client"

import type { EventPopoverPlacement } from "@/lib/calendar/event-popover-position"
import { cn } from "@/lib/utils"

type EventPopoverCalloutArrowProps = {
  placement: EventPopoverPlacement
  arrowOffsetY: number
}

export function EventPopoverCalloutArrow({
  placement,
  arrowOffsetY,
}: EventPopoverCalloutArrowProps) {
  if (placement === "centered") return null

  return (
    <div
      aria-hidden="true"
      className={cn(
        "event-popover-callout-arrow pointer-events-none absolute z-10",
        placement === "right" && "event-popover-callout-arrow--points-left",
        placement === "left" && "event-popover-callout-arrow--points-right",
      )}
      style={{
        top: arrowOffsetY,
      }}
    />
  )
}
