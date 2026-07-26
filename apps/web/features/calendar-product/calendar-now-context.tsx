"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"

type CalendarNowStore = {
  getSnapshot: () => Date
  getDaySnapshot: () => Date
  subscribe: (listener: () => void) => () => void
  subscribeDay: (listener: () => void) => () => void
}

const CalendarNowContext = createContext<CalendarNowStore | null>(null)

function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * Minute-resolution clock for the calendar. Minute subscribers (now line)
 * re-render on tick; day subscribers only re-render when the local date flips.
 */
export function CalendarNowProvider({ children }: { children: ReactNode }) {
  const nowRef = useRef(new Date())
  const dayRef = useRef(new Date())
  const minuteListenersRef = useRef(new Set<() => void>())
  const dayListenersRef = useRef(new Set<() => void>())

  const getSnapshot = useCallback(() => nowRef.current, [])
  const getDaySnapshot = useCallback(() => dayRef.current, [])

  const subscribe = useCallback((listener: () => void) => {
    minuteListenersRef.current.add(listener)
    return () => {
      minuteListenersRef.current.delete(listener)
    }
  }, [])

  const subscribeDay = useCallback((listener: () => void) => {
    dayListenersRef.current.add(listener)
    return () => {
      dayListenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = new Date()
      const dayChanged =
        calendarDayKey(next) !== calendarDayKey(dayRef.current)
      nowRef.current = next
      for (const listener of minuteListenersRef.current) listener()
      if (dayChanged) {
        dayRef.current = next
        for (const listener of dayListenersRef.current) listener()
      }
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const store = useRef<CalendarNowStore>({
    getSnapshot,
    getDaySnapshot,
    subscribe,
    subscribeDay,
  }).current
  store.getSnapshot = getSnapshot
  store.getDaySnapshot = getDaySnapshot
  store.subscribe = subscribe
  store.subscribeDay = subscribeDay

  return (
    <CalendarNowContext.Provider value={store}>
      {children}
    </CalendarNowContext.Provider>
  )
}

/** Minute tick — only the now-line indicator should subscribe. */
export function useCalendarNow(): Date {
  const store = useContext(CalendarNowContext)
  if (!store) {
    throw new Error("useCalendarNow must be used within CalendarNowProvider")
  }
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
}

/** Day boundary only — today highlighting / agenda buckets without minute re-renders. */
export function useCalendarDay(): Date {
  const store = useContext(CalendarNowContext)
  if (!store) {
    throw new Error("useCalendarDay must be used within CalendarNowProvider")
  }
  return useSyncExternalStore(
    store.subscribeDay,
    store.getDaySnapshot,
    store.getDaySnapshot,
  )
}
