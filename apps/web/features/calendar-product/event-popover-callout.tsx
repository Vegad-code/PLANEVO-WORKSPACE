"use client"

import type { EventPopoverPlacement } from "@/lib/calendar/event-popover-position"
import { cn } from "@/lib/utils"

type EventPopoverCalloutArrowProps = {
  placement: EventPopoverPlacement
  arrowOffsetY: number
}

/**
 * Apple Calendar–style callout arrow.
 *
 * The arrow body uses the exact same backdrop-filter glass recipe as the
 * popover shell, clipped to a clean right-angle chevron shape so the glass
 * appears continuous across the join. The border is a tip-only SVG stroke
 * that re-closes the slit cut into the popover shell's border ring.
 *
 * Shape (points-left):
 *   - Base (right edge, x=20) covers the popover edge by --beak-overlap so
 *     there is no visible gap between the two glass layers.
 *   - Tip at ~x=4 with a small radius via cubic bezier.
 *   - Top and bottom arms are straight, meeting the tip at 45°.
 *
 * SVG viewport: 20 × 24 (matches beak-width × beak-height tokens).
 */

// Clip path for the filled glass body.
// Straight 45° arms, rounded tip via C-curve; base overlaps panel edge.
const BEAK_CLIP =
  "M20 2H14L5.5 10C4.7 10.8 4.7 13.2 5.5 14L14 22H20V2Z"

// Stroke path — tip arc only, no base. Closes the gap in the panel border.
const BEAK_STROKE =
  "M14 2L5.5 10C4.7 10.8 4.7 13.2 5.5 14L14 22"

export function EventPopoverCalloutArrow({
  placement,
  arrowOffsetY,
}: EventPopoverCalloutArrowProps) {
  if (placement === "centered") return null

  return (
    <div
      aria-hidden="true"
      className={cn(
        "event-popover-callout-arrow pointer-events-none absolute",
        placement === "right" && "event-popover-callout-arrow--points-left",
        placement === "left" && "event-popover-callout-arrow--points-right",
      )}
      style={{ top: arrowOffsetY }}
    >
      {/* Glass body — same backdrop-filter as the shell */}
      <div
        className="event-popover-callout-arrow__glass"
        style={{ clipPath: `path('${BEAK_CLIP}')` }}
      />
      {/* SVG stroke — tip only, closes the border slit */}
      <svg
        viewBox="0 0 20 24"
        className="event-popover-callout-arrow__stroke-svg"
        aria-hidden="true"
      >
        <path
          className="event-popover-callout-arrow__stroke"
          d={BEAK_STROKE}
          fill="none"
        />
      </svg>
    </div>
  )
}
