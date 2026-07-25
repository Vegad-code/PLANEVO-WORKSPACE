"use client"

import { AnimatePresence, motion } from "framer-motion"
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
      <AnimatePresence mode="wait" initial={false} custom={navMotion.direction}>
        <motion.div
          key={transitionKey}
          custom={navMotion.direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          className="absolute inset-0 flex min-h-0 flex-col"
        >
          <motion.div
            animate={{
              opacity: isFetchingNewRange ? 0.88 : 1,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
            }
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
