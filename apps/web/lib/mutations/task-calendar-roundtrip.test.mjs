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
const viewSource = readFileSync(
  new URL(
    "../../features/calendar-product/calendar-product-view.tsx",
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
    /syncTaskDueTime[\s\S]+await moveTaskLinkedEvent/,
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
  assert.match(viewSource, /completeTaskLinkedEventAction/);
  assert.match(viewSource, /unscheduleTaskLinkedEventAction/);
});
