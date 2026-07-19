"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  CALENDAR_COLORS,
  type CalendarColor,
  type CalendarRow,
} from "@planevo/core/types/calendar";
import {
  CALENDAR_COLOR_DOT_CLASS,
  CalendarColorDot,
} from "./calendar-color-dot";

type CalendarSidebarProps = {
  calendars: CalendarRow[];
  onToggleVisibility: (calendarId: string, isVisible: boolean) => void;
  onCreateCalendar: (name: string, color: CalendarColor) => void;
};

export function CalendarSidebar({
  calendars,
  onToggleVisibility,
  onCreateCalendar,
}: CalendarSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<CalendarColor>("slate");

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreateCalendar(name, newColor);
    setNewName("");
    setNewColor("slate");
    setCreateOpen(false);
  }

  return (
    <nav aria-label="Calendars" className="flex w-full flex-col gap-1">
      <p className="px-2 pb-1 text-label uppercase text-text-muted">Calendars</p>

      {calendars.length === 0 ? (
        <p className="px-2 py-1 text-product-meta text-text-muted">
          No calendars yet
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {calendars.map((calendar) => (
            <li key={calendar.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-raised">
                <input
                  type="checkbox"
                  checked={calendar.is_visible}
                  onChange={(event) =>
                    onToggleVisibility(calendar.id, event.target.checked)
                  }
                  className="size-3.5 shrink-0 cursor-pointer accent-ink"
                />
                <CalendarColorDot color={calendar.color} />
                <span
                  className={`truncate text-product-body ${
                    calendar.is_visible ? "text-ink" : "text-text-muted"
                  }`}
                >
                  {calendar.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {createOpen ? (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-2"
        >
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Calendar name"
            aria-label="Calendar name"
            className="w-full rounded-lg border border-border bg-paper px-2 py-1.5 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
          />
          <div
            role="radiogroup"
            aria-label="Calendar color"
            className="flex items-center gap-1.5 px-0.5"
          >
            {CALENDAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={newColor === color}
                aria-label={color}
                onClick={() => setNewColor(color)}
                className={`flex size-6 items-center justify-center rounded-full border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  newColor === color ? "border-border-strong" : "border-transparent"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-3.5 rounded-full ${CALENDAR_COLOR_DOT_CLASS[color]}`}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="rounded-lg bg-ink px-2.5 py-1 text-product-meta font-medium text-paper hover:opacity-85"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg px-2.5 py-1 text-product-meta text-text-secondary hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-product-body text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New calendar
        </button>
      )}
    </nav>
  );
}
