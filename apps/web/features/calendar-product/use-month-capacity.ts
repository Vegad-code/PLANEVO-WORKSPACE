"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { DEFAULT_MONTH_CAPACITY } from "@/lib/calendar/month-overflow"
import {
  cssLengthToPixels,
  resolveMonthCapacity,
} from "@/lib/calendar/month-capacity"

/**
 * Derives how many item rows fit in a month cell from the grid's real height.
 *
 * The measurement is deliberately arithmetic: observe the body's height, divide
 * by the row count, and subtract fixed token heights. No child element is ever
 * measured, so nothing a chip renders can feed back into the number — which is
 * what keeps this free of an observe/resize/observe loop and of the forced
 * synchronous layout that per-item measurement would cause.
 *
 * react-big-calendar measured a hidden dummy row on week 0 and applied that one
 * limit to every week; because the rows here are `1fr` tracks, one measurement
 * of the container is the true per-row height for the month actually rendered.
 */
export function useMonthCapacity(rowCount: number): {
  bodyRef: (node: HTMLDivElement | null) => void
  capacity: number
} {
  const [capacity, setCapacity] = useState(DEFAULT_MONTH_CAPACITY)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const measure = useCallback(
    (bodyHeightPx: number) => {
      const node = nodeRef.current
      if (!node) return

      const styles = getComputedStyle(node)
      const rootFontSizePx = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      )
      const token = (name: string) =>
        cssLengthToPixels(styles.getPropertyValue(name), rootFontSizePx)

      const dateHeaderPx = token("--size-calendar-month-date-header")
      const cellPaddingPx = token("--spacing-calendar-month-cell-padding")
      const itemRowPx = token("--size-calendar-month-event-row")
      if (dateHeaderPx === null || cellPaddingPx === null || itemRowPx === null) {
        return
      }

      const next = resolveMonthCapacity({
        bodyHeightPx,
        rowCount,
        dateHeaderPx,
        cellPaddingPx,
        itemRowPx,
      })
      if (next !== null) setCapacity(next)
    },
    [rowCount],
  )

  const bodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      nodeRef.current = node
      if (!node) {
        observerRef.current = null
        return
      }

      const observer = new ResizeObserver(([entry]) => {
        if (entry) measure(entry.contentRect.height)
      })
      observer.observe(node)
      observerRef.current = observer
    },
    [measure],
  )

  // Runs before paint, so the server's DEFAULT_MONTH_CAPACITY is corrected
  // without the visible snap react-big-calendar showed on mount (#1648).
  useLayoutEffect(() => {
    const node = nodeRef.current
    if (node) measure(node.getBoundingClientRect().height)
  }, [measure])

  return { bodyRef, capacity }
}
