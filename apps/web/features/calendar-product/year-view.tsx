"use client";

import { useCalendarDay } from "./calendar-now-context";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Day numbers for a month, padded with nulls for the leading weekday offset. */
function monthCells(year: number, month: number): (number | null)[] {
  const leading = new Date(year, month, 1).getDay(); // 0 = Sunday
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  return cells;
}

/** Google-style year view: 12 mini-months. Clicking a day drills into day view. */
export function YearView({
  year,
  today: todayProp,
  onSelectDay,
}: {
  year: number;
  today?: Date;
  onSelectDay: (date: Date) => void;
}) {
  const clockDay = useCalendarDay();
  const today = todayProp ?? clockDay;
  const isThisYear = today.getFullYear() === year;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, month) => (
          <section key={month}>
            <h3 className="mb-3 text-h3 font-medium text-ink">
              {new Date(year, month, 1).toLocaleString("default", {
                month: "long",
              })}
            </h3>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((weekday, index) => (
                <span
                  key={`${weekday}-${index}`}
                  className="pb-1 text-label uppercase text-text-muted"
                >
                  {weekday}
                </span>
              ))}
              {monthCells(year, month).map((day, index) =>
                day === null ? (
                  <span key={`blank-${index}`} />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onSelectDay(new Date(year, month, day))}
                    className={`mx-auto flex size-7 items-center justify-center rounded-full text-product-meta outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      isThisYear &&
                      today.getMonth() === month &&
                      today.getDate() === day
                        ? "bg-ink font-medium text-paper"
                        : "text-ink"
                    }`}
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
