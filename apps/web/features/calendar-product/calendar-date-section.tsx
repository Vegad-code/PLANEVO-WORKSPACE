"use client";

import { useState } from "react";

type CalendarDateSectionProps = {
  now: Date;
  weekStart: Date;
  onSelectDay: (day: Date) => void;
};

/** Mini-month day picker for the Planning sidebar Date accordion. */
export function CalendarDateSection({
  now,
  weekStart,
  onSelectDay,
}: CalendarDateSectionProps) {
  const [cursor, setCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="text-product-body font-medium text-ink">
          {cursor.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-md px-2 py-0.5 text-product-meta text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Prev
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-md px-2 py-0.5 text-product-meta text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Next
          </button>
        </div>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {weekDays.map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="text-label uppercase text-text-muted"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const date = new Date(year, month, day);
          const isToday =
            day === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();
          const inWeek = date >= weekStart && date < weekEnd;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(date)}
              className={`mx-auto flex size-6 items-center justify-center rounded-full text-product-meta outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                isToday
                  ? "bg-ink font-medium text-paper"
                  : inWeek
                    ? "bg-surface-raised font-medium text-ink"
                    : "text-ink hover:bg-surface-raised"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
