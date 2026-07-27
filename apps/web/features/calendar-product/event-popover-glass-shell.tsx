"use client"

import { usePrefersReducedTransparency } from "@/lib/motion/use-prefers-reduced-transparency"
import { cn } from "@/lib/utils"

type EventPopoverGlassShellProps = {
  children: React.ReactNode
  className?: string
  /**
   * CSS variable overrides forwarded from EventDetailPopover so the border
   * mask knows exactly where to cut the slit for the callout arrow.
   *
   * --arrow-y:  distance from popover top to the arrow centre, in px
   * --arrow-side: "left" | "right" — which panel edge the arrow attaches to
   * --arrow-half-h: half-height of the beak in px, used to size the slit gap
   */
  style?: React.CSSProperties
}

/**
 * Visual-only glass for the event popover.
 *
 * Uses CSS backdrop-filter (same as Apple Calendar) rather than a WebGL
 * canvas so the arrow and body can share one continuous glass layer.
 *
 * The border is drawn via a ::before pseudo-element whose mask-image
 * punches a rectangular gap on the arrow side, matching --arrow-y and
 * --arrow-half-h. The callout arrow's SVG stroke re-closes the gap,
 * producing a seamless single-outline shape like the Apple reference.
 */
export function EventPopoverGlassShell({
  children,
  className,
  style,
}: EventPopoverGlassShellProps) {
  const prefersReducedTransparency = usePrefersReducedTransparency()

  return (
    <div
      className={cn(
        prefersReducedTransparency
          ? "event-popover-glass-fallback"
          : "event-popover-glass-body",
        "w-full overflow-visible",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}
