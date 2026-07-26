"use client";

import { useState } from "react";
import { Check, Circle, CircleCheck, Pencil, Plus, X } from "lucide-react";
import {
  CALENDAR_COLORS,
  type CalendarColor,
  type CalendarRow,
} from "@planevo/core/types/calendar";
import {
  CALENDAR_COLOR_DOT_CLASS,
  CalendarColorDot,
} from "./calendar-color-dot";

export type CalendarSourceUpdateInput = {
  name: string;
  color: CalendarColor;
};

export type CalendarSourcesSectionProps = {
  calendars: CalendarRow[];
  onToggleVisibility: (calendarId: string, isVisible: boolean) => void;
  onCreateCalendar: (name: string, color: CalendarColor) => void;
  onUpdateCalendar: (
    calendarId: string,
    input: CalendarSourceUpdateInput,
  ) => void;
  onSetDefaultCalendar: (calendarId: string) => void;
};

type CalendarColorPickerProps = {
  value: CalendarColor;
  onChange: (color: CalendarColor) => void;
  ariaLabel: string;
  name: string;
};

function CalendarColorPicker({
  value,
  onChange,
  ariaLabel,
  name,
}: CalendarColorPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1.5 px-0.5"
    >
      {CALENDAR_COLORS.map((color) => (
        <label
          key={color}
          className={`flex size-6 cursor-pointer items-center justify-center rounded-full border outline-none focus-within:outline focus-within:outline-offset-2 focus-within:outline-ink ${
            value === color ? "border-border-strong" : "border-transparent"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={color}
            checked={value === color}
            onChange={() => onChange(color)}
            aria-label={color}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={`size-3.5 rounded-full ${CALENDAR_COLOR_DOT_CLASS[color]}`}
          />
        </label>
      ))}
    </div>
  );
}

/** Calendar visibility, defaults, and source management for the Planning rail. */
export function CalendarSourcesSection({
  calendars,
  onToggleVisibility,
  onCreateCalendar,
  onUpdateCalendar,
  onSetDefaultCalendar,
}: CalendarSourcesSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<CalendarColor>("slate");
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<CalendarColor>("slate");

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreateCalendar(name, newColor);
    setNewName("");
    setNewColor("slate");
    setCreateOpen(false);
  }

  function handleCreateOpen() {
    setEditingCalendarId(null);
    setCreateOpen(true);
  }

  function handleCreateCancel() {
    setNewName("");
    setNewColor("slate");
    setCreateOpen(false);
  }

  function handleEditOpen(calendar: CalendarRow) {
    setCreateOpen(false);
    setEditingCalendarId(calendar.id);
    setEditName(calendar.name);
    setEditColor(calendar.color);
  }

  function handleEditCancel() {
    setEditingCalendarId(null);
    setEditName("");
    setEditColor("slate");
  }

  function handleEditSubmit(
    event: React.FormEvent<HTMLFormElement>,
    calendarId: string,
  ) {
    event.preventDefault();
    const name = editName.trim();
    if (!name) return;
    onUpdateCalendar(calendarId, { name, color: editColor });
    handleEditCancel();
  }

  return (
    <div className="flex flex-col gap-1 px-0.5">
      {calendars.length === 0 ? (
        <p className="px-2 py-1 text-product-meta text-text-muted">
          No calendars yet
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {calendars.map((calendar) => {
            const editing = editingCalendarId === calendar.id;

            return (
              <li key={calendar.id}>
                {editing ? (
                  <form
                    onSubmit={(event) => handleEditSubmit(event, calendar.id)}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-2"
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      placeholder="Calendar name"
                      aria-label={`Name for ${calendar.name}`}
                      className="w-full rounded-md border border-border bg-paper px-2 py-1.5 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
                    />
                    <CalendarColorPicker
                      value={editColor}
                      onChange={setEditColor}
                      ariaLabel={`Color for ${calendar.name}`}
                      name={`calendar-color-${calendar.id}`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1">
                        <button
                          type="submit"
                          aria-label={`Save changes to ${calendar.name}`}
                          className="flex size-7 items-center justify-center rounded-md bg-ink text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <Check aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing ${calendar.name}`}
                          onClick={handleEditCancel}
                          className="flex size-7 items-center justify-center rounded-md text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                      {calendar.is_default ? (
                        <span className="flex items-center gap-1 text-label text-text-muted">
                          <CircleCheck
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetDefaultCalendar(calendar.id)}
                          className="rounded-md px-1.5 py-1 text-label text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          Set default
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-1 rounded-md pr-1 hover:bg-surface-raised">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={calendar.is_visible}
                        onChange={(event) =>
                          onToggleVisibility(calendar.id, event.target.checked)
                        }
                        aria-label={`Show ${calendar.name}`}
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
                    {calendar.is_default ? (
                      <span
                        title="Default calendar"
                        className="flex size-7 shrink-0 items-center justify-center text-ink"
                      >
                        <CircleCheck aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">
                          {calendar.name} is the default calendar
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Make ${calendar.name} the default calendar`}
                        title="Make default"
                        onClick={() => onSetDefaultCalendar(calendar.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <Circle aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Edit ${calendar.name}`}
                      title="Edit calendar"
                      onClick={() => handleEditOpen(calendar)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
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
            className="w-full rounded-md border border-border bg-paper px-2 py-1.5 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
          />
          <CalendarColorPicker
            value={newColor}
            onChange={setNewColor}
            ariaLabel="Calendar color"
            name="new-calendar-color"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="rounded-md bg-ink px-2.5 py-1 text-product-meta font-medium text-paper hover:opacity-85"
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleCreateCancel}
              className="rounded-md px-2.5 py-1 text-product-meta text-text-secondary hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={handleCreateOpen}
          className="mt-1 flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-product-body text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New calendar
        </button>
      )}
    </div>
  );
}
