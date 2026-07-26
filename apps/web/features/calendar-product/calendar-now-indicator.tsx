"use client"

import { useEffect, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { formatNowIndicatorTime } from "@/lib/calendar/format-now-indicator-time"
import { percentOffsetForTime } from "./time-axis"

type CalendarNowIndicatorProps = {
  now: Date
  visible: boolean
  /** When true, fall back to the sole `.rbc-day-slot` if today class is missing. */
  preferSingleDaySlot?: boolean
  /** Root that contains `.rbc-time-content` / day slots. */
  rbcRootRef: RefObject<HTMLElement | null>
}

function NowIndicatorMarkup({ now }: { now: Date }) {
  return (
    <div
      aria-hidden="true"
      style={{ top: `${percentOffsetForTime(now)}%` }}
      className="planevo-rbc-now-indicator pointer-events-none absolute"
    >
      <div className="planevo-rbc-now-line" />
      <span className="planevo-rbc-now-badge tabular-nums">
        {formatNowIndicatorTime(now)}
      </span>
    </div>
  )
}

/**
 * Now line + rectangular time badge, portaled into today's day column so
 * `top: %` is relative to the full 24h grid (not the scrollport). The line
 * spans only that column.
 */
export function CalendarNowIndicator({
  now,
  visible,
  preferSingleDaySlot = false,
  rbcRootRef,
}: CalendarNowIndicatorProps) {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!visible || !rbcRootRef.current) {
      setMountNode(null)
      return
    }

    const root = rbcRootRef.current

    const findMount = (): HTMLElement | null => {
      const todaySlot =
        root.querySelector(".rbc-day-slot.rbc-today") ??
        root.querySelector(".rbc-day-slot.rbc-now")
      if (todaySlot instanceof HTMLElement) return todaySlot

      if (!preferSingleDaySlot) return null
      const soleSlot = root.querySelector(".rbc-day-slot")
      return soleSlot instanceof HTMLElement ? soleSlot : null
    }

    const existing = findMount()
    if (existing) {
      setMountNode(existing)
      return
    }

    const observer = new MutationObserver(() => {
      const node = findMount()
      if (!node) return
      setMountNode(node)
      observer.disconnect()
    })

    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [visible, rbcRootRef, now, preferSingleDaySlot])

  if (!visible || !mountNode) return null

  return createPortal(<NowIndicatorMarkup now={now} />, mountNode)
}
