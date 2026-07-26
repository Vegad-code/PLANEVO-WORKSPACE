"use client"

import LiquidGlass from "liquid-glass-react"
import { usePrefersReducedTransparency } from "@/lib/motion/use-prefers-reduced-transparency"
import { cn } from "@/lib/utils"

type EventPopoverGlassShellProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Visual-only liquid glass for the event popover.
 *
 * liquid-glass-react (https://github.com/rdev/liquid-glass-react) is built for
 * center-anchored floating chips: it hardcodes translate(-50%,-50%) and renders
 * overlay siblings as position:relative fragments. Nested in a top-left fixed
 * popover that stacked those layers and exploded height (500→1250px).
 *
 * We keep the refraction/frost look, and disable the motion model:
 * - elasticity={0} — no stretch / elastic offset
 * - frozen globalMousePos + mouseOffset — skips mousemove listeners
 * - CSS host contains overlay siblings as absolute insets so they cannot stack
 */
export function EventPopoverGlassShell({
  children,
  className,
}: EventPopoverGlassShellProps) {
  const prefersReducedTransparency = usePrefersReducedTransparency()

  if (prefersReducedTransparency) {
    return (
      <div
        className={cn(
          "event-popover-glass-fallback w-full overflow-hidden rounded-2xl",
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={cn("event-popover-liquid-host w-full", className)}>
      <LiquidGlass
        cornerRadius={16}
        blurAmount={0.1}
        saturation={150}
        aberrationIntensity={1}
        elasticity={0}
        displacementScale={40}
        mode="standard"
        padding="0"
        globalMousePos={FROZEN_MOUSE}
        mouseOffset={FROZEN_MOUSE}
        className="event-popover-liquid-glass"
        style={{
          position: "relative",
          top: 0,
          left: 0,
          width: "100%",
        }}
      >
        <div className="event-popover-liquid-content flex w-full flex-col outline-none">
          {children}
        </div>
      </LiquidGlass>
    </div>
  )
}

const FROZEN_MOUSE = { x: 0, y: 0 } as const
