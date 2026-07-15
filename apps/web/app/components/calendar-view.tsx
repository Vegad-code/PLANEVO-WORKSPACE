"use client";

import { useMemo, useState } from "react";
import type { CalendarData, CalendarItem } from "@/lib/queries/calendar";
import { Icon } from "./planevo-icon";
import { createWorkspaceCalendar } from "@/app/(workspace)/calendar/actions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function itemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const result = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = dateKey(new Date(item.date));
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
}

export function CalendarView({ data }: { data: CalendarData }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const days = useMemo(() => calendarDays(month), [month]);
  const groupedItems = useMemo(() => itemsByDay(data.items), [data.items]);
  const today = dateKey(new Date());

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">All dated work</p>
          <h1 className="mt-2 text-h1">Calendar</h1>
          <p className="mt-2 text-body text-text-secondary">Every dated record across this workspace, in one place.</p>
        </div>
        {!data.hasCalendarDatabase && (
          <form action={createWorkspaceCalendar}>
            <input type="hidden" name="workspaceId" value={data.workspaceId ?? ""} />
            <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-marigold px-4 text-small font-medium text-ink outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Icon name="calendar" />
              Create calendar
            </button>
          </form>
        )}
      </div>

      <section className="mt-8 overflow-hidden rounded-card border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-h3">
            {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}
          </h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"><Icon name="arrow-left" /></button>
            <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="h-8 rounded-lg border border-border bg-paper px-3 text-small outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Today</button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="flex size-8 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"><Icon name="arrow-right" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-paper">
          {WEEKDAYS.map((day) => <div key={day} className="px-2 py-2 text-center text-label uppercase text-text-muted">{day}</div>)}
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-3xl grid-cols-7">
            {days.map((day) => {
            const key = dateKey(day);
            const dayItems = groupedItems.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div key={key} className="min-h-28 border-b border-r border-border bg-paper p-2 last:border-r-0">
                <span className={`flex size-6 items-center justify-center rounded-full text-small ${key === today ? "border border-ink font-medium text-ink" : inMonth ? "text-text-secondary" : "text-text-muted"}`}>
                  {day.getDate()}
                </span>
                <div className="mt-2 space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="truncate rounded-md bg-slate-tint px-2 py-1 text-label text-ink" title={`${item.title} · ${item.databaseName}`}>
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && <p className="px-1 text-label text-text-muted">+{dayItems.length - 3} more</p>}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      {data.items.length === 0 && (
        <p className="mt-4 text-center text-small text-text-muted">No dated records yet. Add a due date to a task or create your first calendar.</p>
      )}
    </div>
  );
}
