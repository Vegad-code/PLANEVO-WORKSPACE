import assert from "node:assert/strict";
import test from "node:test";
import {
  attachFileToTaskActionInputSchema,
  formatTaskFileSize,
  linkTaskToWorkspaceActionInputSchema,
  scheduleRangeFromLocalInputs,
  scheduleTaskActionInputSchema,
  taskCrossLinkOptions,
} from "./task-cross-link-contracts.ts";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_KEY = "44444444-4444-4444-8444-444444444444";

test("scheduleRangeFromLocalInputs converts a valid local range to ISO timestamps", () => {
  const result = scheduleRangeFromLocalInputs({
    date: "2026-07-20",
    startTime: "09:15",
    endTime: "10:45",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.startsAt, /^2026-07-20T/);
  assert.match(result.endsAt, /^2026-07-20T/);
  assert.equal(Date.parse(result.endsAt) - Date.parse(result.startsAt), 90 * 60 * 1000);
});

test("scheduleRangeFromLocalInputs rejects impossible and reversed ranges", () => {
  assert.deepEqual(
    scheduleRangeFromLocalInputs({
      date: "2026-02-30",
      startTime: "09:00",
      endTime: "10:00",
    }),
    { ok: false, error: "Choose a valid date and time." },
  );
  assert.deepEqual(
    scheduleRangeFromLocalInputs({
      date: "2026-07-20",
      startTime: "10:00",
      endTime: "10:00",
    }),
    { ok: false, error: "End time must be after start time." },
  );
  assert.deepEqual(
    scheduleRangeFromLocalInputs({
      date: "2026-07-20",
      startTime: "10:00",
      endTime: "09:00",
    }),
    { ok: false, error: "End time must be after start time." },
  );
});

test("scheduleTaskActionInputSchema requires offset ISO timestamps in forward order", () => {
  assert.equal(
    scheduleTaskActionInputSchema.safeParse({
      taskId: TASK_ID,
      operationKey: OPERATION_KEY,
      startsAt: "2026-07-20T16:00:00.000Z",
      endsAt: "2026-07-20T17:00:00.000Z",
    }).success,
    true,
  );
  assert.equal(
    scheduleTaskActionInputSchema.safeParse({
      taskId: TASK_ID,
      operationKey: OPERATION_KEY,
      startsAt: "2026-07-20T17:00:00.000Z",
      endsAt: "2026-07-20T16:00:00.000Z",
    }).success,
    false,
  );
  assert.equal(
    scheduleTaskActionInputSchema.safeParse({
      taskId: TASK_ID,
      operationKey: OPERATION_KEY,
      startsAt: "2026-07-20 09:00",
      endsAt: "2026-07-20 10:00",
    }).success,
    false,
  );
});

test("cross-link mutation schemas reject malformed resource identifiers", () => {
  assert.equal(
    attachFileToTaskActionInputSchema.safeParse({
      taskId: TASK_ID,
      fileSourceId: FILE_ID,
    }).success,
    true,
  );
  assert.equal(
    attachFileToTaskActionInputSchema.safeParse({
      taskId: TASK_ID,
      fileSourceId: "not-a-file-id",
    }).success,
    false,
  );
  assert.equal(
    linkTaskToWorkspaceActionInputSchema.safeParse({
      taskId: TASK_ID,
      workspaceId: WORKSPACE_ID,
    }).success,
    true,
  );
  assert.equal(
    linkTaskToWorkspaceActionInputSchema.safeParse({
      taskId: "not-a-task-id",
      workspaceId: WORKSPACE_ID,
    }).success,
    false,
  );
});

test("taskCrossLinkOptions hides reservations and attached files, then prioritizes current workspace", () => {
  const options = taskCrossLinkOptions({
    files: [
      {
        id: "visible-file",
        name: "Brief.pdf",
        mime_type: "application/pdf",
        size_bytes: 2_048,
        metadata_json: {},
      },
      {
        id: "pending-upload",
        name: "Pending.pdf",
        mime_type: "application/pdf",
        size_bytes: 1_024,
        metadata_json: {
          source_kind: "task-attachment",
          task_attachment_state: "unclaimed",
        },
      },
      {
        id: "already-attached",
        name: "Notes.txt",
        mime_type: "text/plain",
        size_bytes: 512,
        metadata_json: {
          source_kind: "task-attachment",
          task_attachment_state: "claimed",
        },
      },
    ],
    attachedFileIds: ["already-attached"],
    workspaces: [
      { id: "workspace-other", name: "Personal" },
      { id: "workspace-current", name: "School" },
    ],
    currentWorkspaceId: "workspace-current",
    linkedWorkspaceIds: ["workspace-other"],
  });

  assert.deepEqual(options.files, [
    {
      id: "visible-file",
      name: "Brief.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_048,
    },
  ]);
  assert.deepEqual(options.workspaces, [
    {
      id: "workspace-current",
      name: "School",
      isCurrent: true,
      isLinked: false,
    },
    {
      id: "workspace-other",
      name: "Personal",
      isCurrent: false,
      isLinked: true,
    },
  ]);
});

test("formatTaskFileSize handles unknown, bytes, and compact units", () => {
  assert.equal(formatTaskFileSize(null), "Size unavailable");
  assert.equal(formatTaskFileSize(512), "512 B");
  assert.equal(formatTaskFileSize(2_048), "2 KB");
  assert.equal(formatTaskFileSize(2_621_440), "2.5 MB");
});
