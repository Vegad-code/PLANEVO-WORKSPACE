"use client";

import { useRef } from "react";
import {
  clampPlanningWidth,
  setPlanningWidth,
} from "@/lib/calendar/planning-prefs";

const DRAG_THRESHOLD_PX = 3;

type CalendarResizeHandleProps = {
  width: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

/**
 * Right-edge drag handle for the Calendar Planning rail.
 * Drag resizes (persisted); click without drag collapses — same contract as
 * the Files Library rail.
 */
export function CalendarResizeHandle({
  width,
  onWidthChange,
  onCollapse,
  onResizeStart,
  onResizeEnd,
}: CalendarResizeHandleProps) {
  const drag = useRef<{
    startX: number;
    startWidth: number;
    currentWidth: number;
    moved: boolean;
  } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startWidth: width,
      currentWidth: width,
      moved: false,
    };
    onResizeStart?.();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) >= DRAG_THRESHOLD_PX) {
      drag.current.moved = true;
    }
    if (!drag.current.moved) return;
    const nextWidth = clampPlanningWidth(drag.current.startWidth + delta);
    drag.current.currentWidth = nextWidth;
    onWidthChange(nextWidth);
  }

  function handleEndDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const didMove = drag.current.moved;
    const nextWidth = drag.current.currentWidth;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResizeEnd?.();
    if (!didMove) {
      onCollapse();
      return;
    }
    setPlanningWidth(nextWidth);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize planning sidebar. Click to collapse."
      title="Drag to resize · click to collapse"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleEndDrag}
      onPointerCancel={handleEndDrag}
      className="absolute inset-y-0 right-0 z-50 hidden w-1 cursor-col-resize touch-none bg-transparent lg:block"
    />
  );
}
