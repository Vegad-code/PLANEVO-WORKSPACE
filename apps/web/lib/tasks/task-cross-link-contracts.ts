import { z } from "zod";
import { isVisibleFileSourceMetadata } from "./task-attachments.ts";

const resourceIdSchema = z.string().uuid();
const offsetDateTimeSchema = z.string().datetime({ offset: true });

export const taskCrossLinkOptionsInputSchema = z
  .object({ taskId: resourceIdSchema })
  .strict();

export const scheduleTaskActionInputSchema = z
  .object({
    taskId: resourceIdSchema,
    startsAt: offsetDateTimeSchema,
    endsAt: offsetDateTimeSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End time must be after start time.",
      });
    }
  });

export const attachFileToTaskActionInputSchema = z
  .object({
    taskId: resourceIdSchema,
    fileSourceId: resourceIdSchema,
  })
  .strict();

export const linkTaskToWorkspaceActionInputSchema = z
  .object({
    taskId: resourceIdSchema,
    workspaceId: resourceIdSchema,
  })
  .strict();

export type TaskFileOption = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type TaskWorkspaceOption = {
  id: string;
  name: string;
  isCurrent: boolean;
  isLinked: boolean;
};

export type TaskCrossLinkOptions = {
  files: TaskFileOption[];
  workspaces: TaskWorkspaceOption[];
};

type FileSourceCandidate = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  metadata_json: unknown;
};

type WorkspaceCandidate = {
  id: string;
  name: string;
};

/**
 * Shape already-owned query rows into the two calm pickers. Ownership is
 * proven in the server query; this pure step hides temporary upload
 * reservations, removes existing task attachments, and keeps the active
 * workspace first without dropping other owned workspaces.
 */
export function taskCrossLinkOptions(input: {
  files: readonly FileSourceCandidate[];
  attachedFileIds: readonly string[];
  workspaces: readonly WorkspaceCandidate[];
  currentWorkspaceId: string | null;
  linkedWorkspaceIds: readonly string[];
}): TaskCrossLinkOptions {
  const attachedFileIds = new Set(input.attachedFileIds);
  const linkedWorkspaceIds = new Set(input.linkedWorkspaceIds);

  const files = input.files
    .filter(
      (file) =>
        !attachedFileIds.has(file.id) &&
        isVisibleFileSourceMetadata(file.metadata_json),
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
    }));

  const workspaces = input.workspaces
    .map((workspace, index) => ({
      id: workspace.id,
      name: workspace.name,
      isCurrent: workspace.id === input.currentWorkspaceId,
      isLinked: linkedWorkspaceIds.has(workspace.id),
      index,
    }))
    .sort(
      (left, right) =>
        Number(right.isCurrent) - Number(left.isCurrent) ||
        left.index - right.index,
    )
    .map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      isCurrent: workspace.isCurrent,
      isLinked: workspace.isLinked,
    }));

  return { files, workspaces };
}

type LocalScheduleInput = {
  date: string;
  startTime: string;
  endTime: string;
};

export type ScheduleRangeResult =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; error: string };

function localDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;

  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return null;
  }
  return value;
}

/** Convert browser-local date/time controls into server-safe offset ISO values. */
export function scheduleRangeFromLocalInputs(
  input: LocalScheduleInput,
): ScheduleRangeResult {
  const startsAt = localDateTime(input.date, input.startTime);
  const endsAt = localDateTime(input.date, input.endTime);
  if (!startsAt || !endsAt) {
    return { ok: false, error: "Choose a valid date and time." };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "End time must be after start time." };
  }
  return {
    ok: true,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export function formatTaskFileSize(sizeBytes: number | null): string {
  if (
    sizeBytes === null ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes < 0
  ) {
    return "Size unavailable";
  }
  if (sizeBytes < 1_024) return `${Math.round(sizeBytes)} B`;

  const units = ["KB", "MB", "GB"] as const;
  let value = sizeBytes / 1_024;
  let unitIndex = 0;
  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }
  const compact = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${compact} ${units[unitIndex]}`;
}
