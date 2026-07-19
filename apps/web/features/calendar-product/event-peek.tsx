"use client";

import { useEffect, useRef, useState } from "react";
import { AlignLeft, CalendarDays, Link2, MapPin, Paperclip, Video, X } from "lucide-react";
import type {
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar";
import { CalendarColorDot } from "./calendar-color-dot";
import { formatTimeLabel } from "./time-axis";

const PEEK_WIDTH_REM = 20;
const VIEWPORT_MARGIN_PX = 12;

type EventPeekProps = {
  event: CalendarEventRow;
  calendar: CalendarRow | null;
  anchor: HTMLElement;
  onClose: () => void;
  onLinkTask?: () => void;
  onAttachFile?: () => void;
  onAddToWorkspace?: () => void;
};

function peekPosition(anchor: HTMLElement): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const width = PEEK_WIDTH_REM * remPx;
  let left = rect.right + VIEWPORT_MARGIN_PX;
  if (left + width > window.innerWidth - VIEWPORT_MARGIN_PX) {
    left = Math.max(VIEWPORT_MARGIN_PX, rect.left - width - VIEWPORT_MARGIN_PX);
  }
  const top = Math.min(
    Math.max(rect.top, VIEWPORT_MARGIN_PX),
    // Keep the card from spilling past the bottom; 24rem is its rough height.
    Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - 24 * remPx),
  );
  return { top, left };
}

function eventDescriptionText(event: CalendarEventRow): string {
  const text = event.description_json.text;
  return typeof text === "string" ? text : "";
}

function CrossLinkButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-paper px-2.5 py-1.5 text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

export function EventPeek({
  event,
  calendar,
  anchor,
  onClose,
  onLinkTask,
  onAttachFile,
  onAddToWorkspace,
}: EventPeekProps) {
  const [position] = useState(() => peekPosition(anchor));
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
  const timeLabel = event.all_day
    ? "All day"
    : `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  const description = eventDescriptionText(event);

  return (
    <>
      <button
        type="button"
        aria-label="Close event details"
        tabIndex={-1}
        className="fixed inset-0 z-30 cursor-default"
        onClick={onClose}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-label={event.title}
        tabIndex={-1}
        style={{ top: position.top, left: position.left, width: `${PEEK_WIDTH_REM}rem` }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key !== "Escape") return;
          keyEvent.preventDefault();
          onClose();
        }}
        className="fixed z-40 flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-lg outline-none"
      >
        <header className="flex items-start justify-between gap-2">
          <h3 className="text-h3 text-ink">{event.title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="flex items-center gap-2 text-product-body text-text-secondary">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {dateLabel} — {timeLabel}
          </span>
        </div>

        {calendar ? (
          <div className="flex items-center gap-2 text-product-body text-text-secondary">
            <CalendarColorDot color={calendar.color} />
            <span>{calendar.name}</span>
          </div>
        ) : null}

        {event.location ? (
          <div className="flex items-center gap-2 text-product-body text-text-secondary">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        ) : null}

        {description ? (
          <div className="flex items-start gap-2 text-product-body text-text-secondary">
            <AlignLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="whitespace-pre-wrap">{description}</p>
          </div>
        ) : null}

        <button
          type="button"
          disabled
          title="Meetings come with integrations later"
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-paper px-3 py-2 text-product-body font-medium text-text-muted disabled:cursor-not-allowed"
        >
          <Video aria-hidden="true" className="size-4" />
          Join meeting
        </button>

        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          <CrossLinkButton
            icon={<Link2 aria-hidden="true" className="size-3.5" />}
            label="Link task"
            onClick={onLinkTask}
          />
          <CrossLinkButton
            icon={<Paperclip aria-hidden="true" className="size-3.5" />}
            label="Attach file"
            onClick={onAttachFile}
          />
          <CrossLinkButton
            icon={<CalendarDays aria-hidden="true" className="size-3.5" />}
            label="Add to workspace"
            onClick={onAddToWorkspace}
          />
        </div>
      </div>
    </>
  );
}
