"use client"

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { startsAtFromCalendarPoint } from "@/lib/calendar/fc-slot-from-point"
import type { TaskDragData } from "./today-task-row"
import type { SlotDropData } from "./week-grid"

type CalendarDndContextProps = {
  onScheduleTask: (taskId: string, startsAt: string) => void
  children: React.ReactNode
}

/**
 * Bridges Planning-rail task drags onto grid drops.
 * Supports legacy week-grid SlotDropData and FullCalendar timeGrid via pointer hit-testing.
 */
export function CalendarDndContext({
  onScheduleTask,
  children,
}: CalendarDndContextProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragEnd(dragEvent: DragEndEvent) {
    const taskData = dragEvent.active.data.current as TaskDragData | undefined
    if (taskData?.type !== "task") return

    const slotData = dragEvent.over?.data.current as SlotDropData | undefined
    if (slotData?.type === "slot") {
      onScheduleTask(taskData.taskId, slotData.startsAt)
      return
    }

    const translated = dragEvent.active.rect.current.translated
    if (!translated) return
    const clientX = translated.left + translated.width / 2
    const clientY = translated.top + translated.height / 2
    const startsAt = startsAtFromCalendarPoint(clientX, clientY)
    if (!startsAt) return
    onScheduleTask(taskData.taskId, startsAt)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  )
}
