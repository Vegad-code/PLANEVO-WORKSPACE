"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { CalendarRow } from "@planevo/core/types/calendar";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { formatTimeLabel } from "./time-axis";

const DURATION_OPTIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "90 minutes" },
  { minutes: 120, label: "2 hours" },
] as const;

export type CreateEventInput = {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

type CreateEventPopoverProps = {
  slotStart: Date;
  calendars: CalendarRow[];
  onSubmit: (input: CreateEventInput) => void;
  onClose: () => void;
  isPending?: boolean;
};

export function CreateEventPopover({
  slotStart,
  calendars,
  onSubmit,
  onClose,
  isPending = false,
}: CreateEventPopoverProps) {
  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState(60);

  const slotLabel = `${slotStart.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  })} at ${formatTimeLabel(slotStart)}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !calendarId) return;
    const endsAt = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
    onSubmit({
      calendarId,
      title: trimmedTitle,
      startsAt: slotStart.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="create-event-title"
      className="spotlight-glass-panel m-4 w-[min(100%,24rem)] overflow-hidden rounded-2xl p-0 text-ink backdrop:bg-ink/30 sm:m-auto"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="create-event-title" className="text-h3 font-medium text-ink">
              New event
            </h2>
            <p className="mt-0.5 truncate text-product-meta text-text-muted">
              {slotLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <label className="block">
            <span className="mb-2 block text-label uppercase text-text-muted">
              Title
            </span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What's happening?"
              className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
            />
          </label>

          <SelectField
            label="Calendar"
            value={calendarId}
            onChange={(event) => setCalendarId(event.target.value)}
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Duration"
            value={String(durationMinutes)}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-small font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !title.trim() || !calendarId}
            className="rounded-lg bg-ink px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create event
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
