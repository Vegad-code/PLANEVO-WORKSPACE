"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  calendarDays,
  dateKey,
  groupByDay,
  monthParam,
  parseMonthParam,
} from "@planevo/core/state/calendar-state";
import { Icon } from "@/components/ui/planevo-icon";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type MonthGridItem = {
  id: string;
  title: string;
  date: string;
  subtitle?: string;
};

const NAV_BUTTON_CLASS =
  "flex size-8 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";
const TODAY_BUTTON_CLASS =
  "flex h-8 items-center rounded-lg border border-border bg-paper px-3 text-small outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * One month grid for any dated records. With `monthHrefBase` set, month
 * navigation is server-driven links (?month=YYYY-MM → the server loads that
 * range); without it, navigation is local state over already-loaded items.
 */
export function MonthGrid({
  items,
  month,
  monthHrefBase,
}: {
  items: MonthGridItem[];
  month?: string;
  monthHrefBase?: string;
}) {
  const initialMonth =
    parseMonthParam(month) ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [localMonth, setLocalMonth] = useState(initialMonth);
  const activeMonth = monthHrefBase ? initialMonth : localMonth;

  const days = useMemo(() => calendarDays(activeMonth), [activeMonth]);
  const groupedItems = useMemo(() => groupByDay(items), [items]);
  const today = dateKey(new Date());

  const monthTitle = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(activeMonth);

  function href(target: Date): string {
    return `${monthHrefBase}?month=${monthParam(target)}`;
  }

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-h3">{monthTitle}</h2>
        <div className="flex items-center gap-1">
          {monthHrefBase ? (
            <>
              <Link href={href(addMonths(activeMonth, -1))} aria-label="Previous month" className={NAV_BUTTON_CLASS}>
                <Icon name="arrow-left" />
              </Link>
              <Link href={monthHrefBase} className={TODAY_BUTTON_CLASS}>
                Today
              </Link>
              <Link href={href(addMonths(activeMonth, 1))} aria-label="Next month" className={NAV_BUTTON_CLASS}>
                <Icon name="arrow-right" />
              </Link>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setLocalMonth(addMonths(localMonth, -1))} aria-label="Previous month" className={NAV_BUTTON_CLASS}>
                <Icon name="arrow-left" />
              </button>
              <button
                type="button"
                onClick={() => setLocalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                className={TODAY_BUTTON_CLASS}
              >
                Today
              </button>
              <button type="button" onClick={() => setLocalMonth(addMonths(localMonth, 1))} aria-label="Next month" className={NAV_BUTTON_CLASS}>
                <Icon name="arrow-right" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-paper">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-label uppercase text-text-muted">
            {day}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-2xl grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const dayItems = groupedItems.get(key) ?? [];
            const inMonth = day.getMonth() === activeMonth.getMonth();
            return (
              <div key={key} className="min-h-28 border-b border-r border-border bg-paper p-2 last:border-r-0">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-small ${
                    key === today
                      ? "border border-ink font-medium text-ink"
                      : inMonth
                        ? "text-text-secondary"
                        : "text-text-muted"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-2 space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="truncate rounded-md bg-slate-tint px-2 py-1 text-label text-ink"
                      title={item.subtitle ? `${item.title} · ${item.subtitle}` : item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="px-1 text-label text-text-muted">+{dayItems.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
