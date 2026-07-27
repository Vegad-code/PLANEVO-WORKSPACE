import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionsSource = readFileSync(
  new URL("../../app/(workspace)/calendar/actions.ts", import.meta.url),
  "utf8",
);
const panelSource = readFileSync(
  new URL("../../features/calendar-product/event-detail-panel.tsx", import.meta.url),
  "utf8",
);
const mutationsSource = readFileSync(
  new URL(
    "../../features/calendar-product/use-calendar-mutations.ts",
    import.meta.url,
  ),
  "utf8",
);
const atomicReminderMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260726127000_atomic_event_reminders.sql",
    import.meta.url,
  ),
  "utf8",
);

test("calendar actions use atomic task round-trip mutations", () => {
  assert.match(actionsSource, /setTaskStatusWithLinkedEvents/);
  assert.match(
    actionsSource,
    /if \(event\.task_id\) \{\s+await moveTaskLinkedEvent/s,
  );
  assert.match(
    actionsSource,
    /update_calendar_event_with_reminder/,
  );
  assert.match(atomicReminderMigration, /perform pg_advisory_xact_lock/);
  assert.match(
    atomicReminderMigration,
    /update public\.tasks task[\s\S]+due_at = v_starts_at/,
  );
  assert.match(actionsSource, /completeTaskLinkedEventAction/);
  assert.match(actionsSource, /unscheduleTaskLinkedEventAction/);
  assert.match(
    actionsSource,
    /linkTaskToEvent\(access\.client, access\.ownerId/,
  );
});

test("deleting a task block preserves its task", () => {
  assert.match(
    actionsSource,
    /if \(event\.task_id\) \{\s+await unscheduleTaskLinkedEvent/s,
  );
  assert.ok(actionsSource.includes('revalidatePath("/tasks")'));
});

test("linked task event controls explain completion and unscheduling", () => {
  assert.match(panelSource, /aria-label={`Linked task: \$\{linkedTaskTitle\}`}/);
  assert.match(panelSource, /Complete task: \$\{linkedTaskTitle\}/);
  assert.match(
    panelSource,
    /The task stays in Tasks and returns to the backlog\./,
  );
  // Both actions are wired in the shared mutation hook, not the view.
  assert.match(mutationsSource, /completeTaskLinkedEventAction/);
  assert.match(mutationsSource, /unscheduleTaskLinkedEventAction/);
});
