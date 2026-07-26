"use client";

import { AlignLeft, Link2, MapPin, Paperclip } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { CalendarRow } from "@planevo/core/types/calendar";
import { cn } from "@/lib/utils";
import type { EventFormState } from "@/lib/calendar/event-form-state";
import type { EventCrossLinkPanel } from "./event-cross-links";

/**
 * The structured half of the event card: every field, spelled out. Quick capture
 * writes into the same `EventFormState`, so switching modes never loses a value.
 */
type EventDetailFieldsProps = {
  form: EventFormState;
  onFormChange: (patch: Partial<EventFormState>) => void;
  calendars: CalendarRow[];
  durationLabel: string | null;
  showCrossLinks: boolean;
  onOpenCrossLink?: (panel: EventCrossLinkPanel) => void;
  titleRef?: React.RefObject<HTMLInputElement | null>;
};

const ROW_CLASS = "event-card-divider flex items-center gap-2 px-3 py-2";
const PLAIN_INPUT_CLASS =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:outline-none";

/** A native date or time input dressed as a pill — keyboard entry intact, OS glyph gone. */
function DateTimePill({
  type,
  value,
  onChange,
  label,
  className,
}: {
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "event-card-control relative inline-flex items-center rounded-lg px-2 py-1",
        className,
      )}
    >
      <input
        type={type}
        value={value}
        aria-label={label}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
        className="w-full border-0 bg-transparent p-0 text-product-meta text-ink outline-none focus-visible:outline-none"
      />
    </span>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(changeEvent) => onChange(changeEvent.target.value)}
      onInput={syncHeight}
      rows={1}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-product-meta leading-relaxed text-ink outline-none placeholder:text-text-muted focus-visible:outline-none"
    />
  );
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
      className="event-card-control flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-product-meta font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

export function EventDetailFields({
  form,
  onFormChange,
  calendars,
  durationLabel,
  showCrossLinks,
  onOpenCrossLink,
  titleRef,
}: EventDetailFieldsProps) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5">
        <input
          ref={titleRef}
          value={form.title}
          onChange={(changeEvent) =>
            onFormChange({ title: changeEvent.target.value })
          }
          placeholder="Add a title"
          aria-label="Event title"
          className="w-full border-0 bg-transparent p-0 text-h3 font-medium text-ink outline-none placeholder:font-normal placeholder:text-text-muted focus-visible:outline-none"
        />
      </div>

      <div className={ROW_CLASS}>
        <span className="flex w-14 shrink-0 items-center gap-1.5 text-label uppercase text-text-muted">
          Starts
        </span>
        <DateTimePill
          type="date"
          label="Start date"
          value={form.startsDate}
          onChange={(startsDate) => onFormChange({ startsDate })}
          className="flex-1"
        />
        <DateTimePill
          type="time"
          label="Start time"
          value={form.startsTime}
          onChange={(startsTime) => onFormChange({ startsTime })}
        />
      </div>

      <div className={ROW_CLASS}>
        <span className="flex w-14 shrink-0 items-center gap-1.5 text-label uppercase text-text-muted">
          Ends
        </span>
        <DateTimePill
          type="date"
          label="End date"
          value={form.endsDate}
          onChange={(endsDate) => onFormChange({ endsDate })}
          className="flex-1"
        />
        <DateTimePill
          type="time"
          label="End time"
          value={form.endsTime}
          onChange={(endsTime) => onFormChange({ endsTime })}
        />
      </div>

      {durationLabel ? (
        <p className="px-3 pb-2 pl-[4.5rem] text-product-meta text-text-muted">
          {durationLabel}
        </p>
      ) : null}

      <label className={ROW_CLASS}>
        <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
        <input
          value={form.location}
          onChange={(changeEvent) =>
            onFormChange({ location: changeEvent.target.value })
          }
          placeholder="Add a location"
          aria-label="Event location"
          className={PLAIN_INPUT_CLASS}
        />
      </label>

      <label className={cn(ROW_CLASS, "items-start")}>
        <AlignLeft
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0 text-text-muted"
        />
        <AutoGrowTextarea
          value={form.description}
          onChange={(description) => onFormChange({ description })}
          placeholder="Add notes"
          ariaLabel="Event notes"
        />
      </label>

      {showCrossLinks && onOpenCrossLink ? (
        <div className={cn(ROW_CLASS, "flex-wrap gap-1.5")}>
          <CrossLinkButton
            icon={<Link2 aria-hidden="true" className="size-3.5" />}
            label="Link task"
            onClick={() => onOpenCrossLink("task")}
          />
          <CrossLinkButton
            icon={<Paperclip aria-hidden="true" className="size-3.5" />}
            label="Attach file"
            onClick={() => onOpenCrossLink("files")}
          />
          <CrossLinkButton
            icon={<AlignLeft aria-hidden="true" className="size-3.5" />}
            label="Add to workspace"
            onClick={() => onOpenCrossLink("workspace")}
          />
        </div>
      ) : null}

      {calendars.length === 0 ? (
        <p className={cn(ROW_CLASS, "text-product-meta text-text-secondary")}>
          Create a calendar before saving events.
        </p>
      ) : null}
    </div>
  );
}
