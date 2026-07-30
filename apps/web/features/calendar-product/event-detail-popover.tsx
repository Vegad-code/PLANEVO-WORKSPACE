"use client"

import { motion } from "framer-motion"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { EventPopoverCalloutArrow } from "./event-popover-callout"
import { EventPopoverGlassShell } from "./event-popover-glass-shell"
import {
  EVENT_POPOVER_MOBILE_MAX_WIDTH_PX,
  EVENT_POPOVER_WIDTH_REM,
  getEventPopoverPanelWidthPx,
  getEventPopoverPosition,
  type EventPopoverPosition,
} from "@/lib/calendar/event-popover-position"
import { getShellLayoutTransition } from "@/lib/motion/shell-spring"
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

type EventDetailPopoverProps = {
  anchorRect: DOMRect
  /**
   * `outside-pointer` is the dismiss-then-slot-select race: callers must arm
   * create-gesture suppress so the same click does not reopen create.
   */
  onClose: (meta?: { reason: "escape" | "outside-pointer" }) => void
  children: React.ReactNode
  className?: string
  /** Reserved for callers; glass mouse tracking is intentionally frozen. */
  mouseContainerRef?: RefObject<HTMLElement | null>
  /**
   * When true, outside-click and Escape do not dismiss — used while a nested
   * surface (cross-link picker, custom color wheel) is open outside this tree.
   * Match GCal: grid click with the wheel open closes the wheel, not the card.
   */
  suppressDismiss?: boolean
}

function positionsEqual(
  current: EventPopoverPosition | null,
  next: EventPopoverPosition,
): boolean {
  if (!current) return false
  return (
    current.top === next.top &&
    current.left === next.left &&
    current.centered === next.centered &&
    current.placement === next.placement &&
    current.arrowOffsetY === next.arrowOffsetY
  )
}

/**
 * Side-anchored create/edit popover (Vegad-code/planevo placement model).
 * Outer shell owns fixed top/left. Inner shell is visual-only liquid glass.
 */
export function EventDetailPopover({
  anchorRect,
  onClose,
  children,
  className,
  suppressDismiss = false,
}: EventDetailPopoverProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const transition = getShellLayoutTransition(prefersReducedMotion)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const [position, setPosition] = useState<EventPopoverPosition | null>(null)

  useEffect(() => {
    const media = window.matchMedia(
      `(max-width: ${EVENT_POPOVER_MOBILE_MAX_WIDTH_PX}px)`,
    )
    const updateViewport = () => setIsNarrow(media.matches)
    updateViewport()
    media.addEventListener("change", updateViewport)
    return () => media.removeEventListener("change", updateViewport)
  }, [])

  useLayoutEffect(() => {
    const updatePosition = () => {
      const panel = panelRef.current?.getBoundingClientRect()
      if (!panel) return
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const nextPosition = getEventPopoverPosition({
        anchorRect,
        panel: {
          left: 0,
          top: 0,
          width: panel.width || getEventPopoverPanelWidthPx(remPx),
          height: panel.height,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        isNarrow,
      })
      if (
        !Number.isFinite(nextPosition.top) ||
        !Number.isFinite(nextPosition.left)
      ) {
        return
      }
      setPosition((current) =>
        positionsEqual(current, nextPosition) ? current : nextPosition,
      )
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    const observer = new ResizeObserver(updatePosition)
    if (panelRef.current) observer.observe(panelRef.current)

    return () => {
      window.removeEventListener("resize", updatePosition)
      observer.disconnect()
    }
  }, [anchorRect, isNarrow])

  useEffect(() => {
    if (suppressDismiss) return
    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      // Portaled color wheel sits outside this tree but belongs to the card.
      if (
        (event.target as Element | null)?.closest?.(
          "[data-calendar-color-wheel]",
        )
      ) {
        return
      }
      onClose({ reason: "outside-pointer" })
    }
    const frame = window.requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handlePointerDown)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [onClose, suppressDismiss])

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      initial={
        prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 2 }
      }
      animate={
        position
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: 0.98, y: 0 }
      }
      exit={
        prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98, y: 1 }
      }
      transition={transition}
      style={
        position
          ? {
              top: position.top,
              left: position.left,
              width: `${EVENT_POPOVER_WIDTH_REM}rem`,
              visibility: "visible",
            }
          : {
              top: anchorRect.top,
              left: anchorRect.right + 12,
              width: `${EVENT_POPOVER_WIDTH_REM}rem`,
              visibility: "hidden",
            }
      }
      data-event-detail-popover=""
      data-placement={position?.placement}
      className={cn("fixed z-50 outline-none", className)}
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key !== "Escape" || suppressDismiss) return
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
        onClose({ reason: "escape" })
      }}
    >
      <div className="relative w-full">
        <EventPopoverGlassShell
          style={
            position && position.placement !== "centered"
              ? ({
                  "--arrow-y": `${position.arrowOffsetY}px`,
                  "--arrow-side": position.placement === "right" ? "left" : "right",
                  "--arrow-half-h": "var(--size-event-popover-callout-beak-half-height)",
                } as React.CSSProperties)
              : undefined
          }
        >
          {children}
        </EventPopoverGlassShell>
        {position ? (
          <EventPopoverCalloutArrow
            placement={position.placement}
            arrowOffsetY={position.arrowOffsetY}
          />
        ) : null}
      </div>
    </motion.div>
  )
}
