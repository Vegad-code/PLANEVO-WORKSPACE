"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { startsAtFromCalendarPoint } from "@/lib/calendar/slot-from-point"
import {
  resolveMonthDrag,
  type MonthDragData,
  type MonthDropData,
  type MonthMoveResult,
} from "@/lib/calendar/month-drag"
import type { TaskDragData } from "./today-task-row"
import { MonthDragOverlay } from "./month-drag-overlay"

type CalendarDndContextProps = {
  onScheduleTask: (taskId: string, startsAt: string) => void
  onMonthMove: (move: MonthMoveResult) => void
  children: React.ReactNode
}

type ActiveMonthDrag = {
  drag: MonthDragData
  width: number | null
}

/**
 * Owns every calendar drag: Planning-rail tasks onto time slots, and Month's
 * chips, bars, and resize handles onto day cells.
 *
 * One context rather than one per surface — dnd-kit does not support nesting
 * them — so the drag payload's `type` decides which gesture just finished.
 *
 * Month moves use a DragOverlay clone: sources live inside overflow-clipped
 * cells, so transforming them makes the event vanish. The overlay follows the
 * pointer outside that clipping; the source stays put and fades.
 */
export function CalendarDndContext({
  onScheduleTask,
  onMonthMove,
  children,
}: CalendarDndContextProps) {
  const [activeMonthDrag, setActiveMonthDrag] = useState<ActiveMonthDrag | null>(
    null,
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragStart(dragEvent: DragStartEvent) {
    const data = dragEvent.active.data.current as
      | MonthDragData
      | TaskDragData
      | undefined

    if (data?.type !== "month-move" && data?.type !== "month-resize") {
      setActiveMonthDrag(null)
      return
    }

    const initial = dragEvent.active.rect.current.initial
    setActiveMonthDrag({
      drag: data,
      width: initial?.width ?? null,
    })
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    const dragged = dragEvent.active.data.current as
      | MonthDragData
      | TaskDragData
      | undefined

    setActiveMonthDrag(null)

    if (dragged?.type === "month-move" || dragged?.type === "month-resize") {
      const dropped = dragEvent.over?.data.current as MonthDropData | undefined
      if (dropped?.type !== "month-day") return
      const move = resolveMonthDrag(dragged, dropped)
      if (move) onMonthMove(move)
      return
    }

    const taskData = dragged
    if (taskData?.type !== "task") return

    // The time grid registers no droppable slots — RBC owns that DOM — so a task
    // drop is resolved from the pointer's position over the grid.
    const translated = dragEvent.active.rect.current.translated
    if (!translated) return
    const clientX = translated.left + translated.width / 2
    const clientY = translated.top + translated.height / 2
    const startsAt = startsAtFromCalendarPoint(clientX, clientY)
    if (!startsAt) return
    onScheduleTask(taskData.taskId, startsAt)
  }

  function handleDragCancel() {
    setActiveMonthDrag(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeMonthDrag ? (
          <MonthDragOverlay
            drag={activeMonthDrag.drag}
            width={activeMonthDrag.width}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
