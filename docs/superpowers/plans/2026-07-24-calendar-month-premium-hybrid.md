# Planevo Month Grid Premium Hybrid Revamp

**Status:** Approved for implementation  
**Scope:** Month grid and month day-agenda interaction only

## Global constraints

- Preserve the Calendar toolbar, Planning rail, Day/Week/Year views, navigation, and React Big Calendar engine.
- Preserve all existing uncommitted Calendar work; do not reset or overwrite unrelated changes.
- Use Planevo CSS custom properties and themed utilities only. No raw colors, font names, or arbitrary component pixel values.
- References guide craft only. Keep Planevo IA and do not introduce competitor names in UI copy.
- Calendar chrome uses no marigold. Ocean is reserved for today; calendar colors are user-content colors.
- Sunday remains the first day of the week.
- Month drag-create, drag-move, and resize remain disabled.
- No database, API, route, or migration changes.

## Task 1: Unified month item model and tests

Create an internal discriminated month item model with:

- `kind: "event" | "task"`
- `displayStyle: "timed" | "bar" | "task"`
- Event metadata required by React Big Calendar, including calendar color and synced-source state.
- Task metadata required for due date, completion state, and toggle behavior.

Add pure helpers that:

- Classify timed single-day events as `timed`.
- Classify all-day and multi-day events as `bar`, with exclusive all-day ends handled correctly.
- Convert loaded `TaskDueChip` values into `task` items.
- Filter hidden calendars.
- Sort items by: spanning/all-day events, open task dues, timed events by start, completed task dues.
- Return every item overlapping a local calendar day for agenda and overflow usage.

Write focused unit tests for classification, local-day spanning, exclusive all-day ends, task conversion, completion state, sorting, hidden calendars, synced-source metadata, and local-day overlap.

## Task 2: Month grid and agenda behavior

Extend `CalendarGridEngine` with `taskDues` and `onToggleTask`, and pass the already-loaded values/callback from `CalendarProductView`.

For Month only:

- Feed the unified month items to React Big Calendar.
- Timed single-day events render as transparent compact rows with a calendar-color dot, compact time, synced indicator when applicable, and truncated title.
- All-day and multi-day events render as soft filled spanning bars with a calendar-color edge and title.
- Task due dates render as neutral checkbox rows. Completed tasks remain visible, checked, muted, and struck through.
- Event selection continues to open `EventPeek`.
- Task checkbox interaction calls the existing task-status action.
- `+N more` counts all hidden event and task items.
- Month drag and resize remain disabled.

Upgrade `MonthDayAgendaPopover`:

- Show the complete unified ordered list for the selected day.
- Preserve event selection and add task completion toggles.
- Desktop uses a viewport-clamped anchored panel with no visible dim backdrop.
- Narrow layouts use a bottom sheet.
- Escape and click-away close it and restore focus to the originating day/cell.
- “Open day” and double-click still enter Day view.

Add focused interaction or contract tests for event/task dispatch, toggle behavior, overflow item inclusion, agenda ordering, explicit Day drill-down, and disabled Month drag/resize.

## Task 3: Premium hybrid month craft and design states

Keep the existing 24px Calendar shell, but:

- Remove doubled weekday padding and the raised weekday band.
- Use one flat grid surface with subtle month-specific dividers.
- Center weekday labels and date labels.
- Use a muted treatment for outside-month cells.
- Use only the ocean date disc for today; remove whole-cell today tint.
- Render only the five or six week rows required by the displayed month while retaining the existing 42-day query window.
- Keep compact title-based rows rather than dots-only cells.

Add or adjust month-scoped tokens in `globals.css` for divider strength, row height/gap, dot size, task checkbox size, cell padding, and responsive agenda geometry. Component code must consume tokens.

Extend `/design` with empty, normal, dense-overflow, multi-day, outside-month, and task-due states. Add the missing client boundary to the shared Radix-backed `Badge` component so `/design` renders.

Run visual QA at 2940×1600 and 1440×900 in light/dark modes, with Planning expanded/collapsed, and across five- and six-week months. Compare the implementation and supplied references together.

## Task 4: Final verification

Run:

- Focused month/calendar unit tests.
- Core calendar query tests.
- Full web test suite.
- TypeScript validation.
- Production build.

Verify manually:

- Sparse/dense days, long titles, multi-day continuation, padding-day events, and task completion.
- Day agenda open/close/focus behavior, event peek, `+N more`, and Day drill-down.
- Day/Week/Year, toolbar, Planning rail, navigation, overlap loading, and query keys remain unchanged.
