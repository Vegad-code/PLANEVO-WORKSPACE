"use client"

import { motion } from "framer-motion"
import type { CalendarNavMotion } from "@/lib/calendar/calendar-nav-motion"
import {
  calendarNavTransition,
  calendarTransitionKey,
  calendarViewMotionVariants,
} from "@/lib/calendar/calendar-nav-motion"
import type { CalendarToolbarView } from "@/lib/calendar/calendar-navigation"
import { cn } from "@/lib/utils"

type CalendarViewTransitionProps = {
  view: CalendarToolbarView
  anchor: Date
  navMotion: CalendarNavMotion
  prefersReducedMotion: boolean
  isFetchingNewRange?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Crossfade the active grid without AnimatePresence remounting two full
 * calendar trees (popLayout/wait both paid a double-mount tax on every step).
 */
export function CalendarViewTransition({
  view,
  anchor,
  navMotion,
  prefersReducedMotion,
  isFetchingNewRange = false,
  className,
  children,
}: CalendarViewTransitionProps) {
  const transitionKey = calendarTransitionKey(view, anchor)
  const variants = calendarViewMotionVariants(navMotion.intent)
  const transition = calendarNavTransition(prefersReducedMotion)

  return (
    <div
      className={cn("relative min-h-0 flex-1 overflow-hidden", className)}
      aria-live="polite"
      aria-busy={isFetchingNewRange}
    >
      <motion.div
        key={transitionKey}
        custom={navMotion.direction}
        variants={variants}
        initial="enter"
        animate="center"
        transition={transition}
        className="absolute inset-0 flex min-h-0 flex-col"
        style={{ opacity: isFetchingNewRange ? 0.92 : 1 }}
      >
        {children}
      </motion.div>
    </div>
  )
}
