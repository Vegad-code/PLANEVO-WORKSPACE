"use client";

import { useRef } from "react";

const DRAG_THRESHOLD_PX = 3;

type SidebarResizeHandleProps = {
  width: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
};

export function SidebarResizeHandle({
  width,
  onWidthChange,
  onCollapse,
}: SidebarResizeHandleProps) {
  const drag = useRef<{
    startX: number;
    startWidth: number;
    moved: boolean;
  } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startWidth: width,
      moved: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) >= DRAG_THRESHOLD_PX) {
      drag.current.moved = true;
    }
    if (drag.current.moved) {
      onWidthChange(drag.current.startWidth + delta);
    }
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const didMove = drag.current.moved;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!didMove) {
      onCollapse();
    }
  }

  return (
    <div
      data-testid="sidebar-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar. Click to collapse."
      title="Drag to resize · click to collapse"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="absolute inset-y-0 right-0 z-50 w-1 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-border-strong motion-reduce:transition-none"
    />
  );
}
