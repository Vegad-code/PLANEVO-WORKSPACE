"use client";

import {
  AlignLeft,
  Bell,
  Link2,
  MapPin,
  Paperclip,
  Repeat,
} from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { CalendarRow } from "@planevo/core/types/calendar";
import { cn } from "@/lib/utils";
import {
  weeklyRruleForDate,
  type EventFormState,
} from "@/lib/calendar/event-form-state";
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
  reminderOffsetMinutes: number | null;
  onReminderChange: (offsetMinutes: number | null) => void;
  reminderDisabled?: boolean;
  showCrossLinks: boolean;
  taskLinked?: boolean;
  onOpenCrossLink?: (panel: EventCrossLinkPanel) => void;
  titleRef?: React.RefObject<HTMLInputElement | null>;
};

const ROW_CLASS = "event-card-divider flex items-center gap-2 px-3 py-2";
const PLAIN_INPUT_CLASS =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:outline-none";

function recurrencePreset(form: EventFormState): string {
  const weekly = weeklyRruleForDate(form.startsDate);
  if (
    form.rrule === null ||
    form.rrule === "FREQ=DAILY" ||
    form.rrule === weekly ||
    form.rrule === "FREQ=MONTHLY" ||
    form.rrule === "FREQ=YEARLY"
  ) {
    return form.rrule ?? "";
  }
  return "custom";
}

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
  reminderOffsetMinutes,
  onReminderChange,
  reminderDisabled = false,
  showCrossLinks,
  taskLinked = false,
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

      <div className={ROW_CLASS}>
        <Bell aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
        <select
          aria-label="Browser reminder"
          disabled={reminderDisabled}
          value={reminderOffsetMinutes === null ? "" : reminderOffsetMinutes}
          onChange={(event) =>
            onReminderChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          className={cn(
            PLAIN_INPUT_CLASS,
            reminderDisabled && "cursor-not-allowed text-text-muted",
          )}
        >
          <option value="">No reminder</option>
          <option value="0">At start time</option>
          <option value="5">5 minutes before</option>
          <option value="10">10 minutes before</option>
          <option value="15">15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60">1 hour before</option>
          <option value="1440">1 day before</option>
        </select>
      </div>
      <p className="px-3 pb-2 pl-[4.5rem] text-label text-text-muted">
        Browser reminders fire while Planevo is open.
        {reminderDisabled ? " Repeating events are not supported yet." : ""}
      </p>

      <div className={ROW_CLASS}>
        <Repeat aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
        <select
          aria-label="Repeats"
          disabled={taskLinked}
          value={recurrencePreset(form)}
          onChange={(changeEvent) => {
            const value = changeEvent.target.value;
            onFormChange({
              rrule:
                value === ""
                  ? null
                  : value === "custom"
                    ? `FREQ=WEEKLY;INTERVAL=2;BYDAY=${weeklyRruleForDate(
                        form.startsDate,
                      ).replace("FREQ=WEEKLY;BYDAY=", "")}`
                    : value,
            });
          }}
          className={cn(
            PLAIN_INPUT_CLASS,
            taskLinked && "cursor-not-allowed text-text-muted",
          )}
        >
          <option value="">Does not repeat</option>
          <option value="FREQ=DAILY">Daily</option>
          <option value={weeklyRruleForDate(form.startsDate)}>
            Weekly on this day
          </option>
          <option value="FREQ=MONTHLY">Monthly</option>
          <option value="FREQ=YEARLY">Yearly</option>
          <option value="custom">Custom RRULE</option>
        </select>
      </div>

      {recurrencePreset(form) === "custom" ? (
        <label className={ROW_CLASS}>
          <span className="w-14 shrink-0 text-label uppercase text-text-muted">
            Rule
          </span>
          <input
            value={form.rrule ?? ""}
            onChange={(changeEvent) =>
              onFormChange({ rrule: changeEvent.target.value || null })
            }
            placeholder="FREQ=WEEKLY;INTERVAL=2"
            aria-label="Custom recurrence rule"
            className={PLAIN_INPUT_CLASS}
          />
        </label>
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
          {!taskLinked ? (
            <CrossLinkButton
              icon={<Link2 aria-hidden="true" className="size-3.5" />}
              label="Link task"
              onClick={() => onOpenCrossLink("task")}
            />
          ) : null}
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
