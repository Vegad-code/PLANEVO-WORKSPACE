import type { TaskIconStyle } from "@planevo/core/tasks/task-icon-types";

export type TaskIconDisplaySize = "slot" | "peek" | "picker" | "picker-grid";

const PLAIN_SIZE_CLASS: Record<TaskIconDisplaySize, string> = {
  slot: "size-9",
  peek: "size-6",
  picker: "size-4",
  "picker-grid": "text-icon-emoji-xs leading-none",
};

const EMOJI_SIZE_CLASS: Record<TaskIconDisplaySize, string> = {
  slot: "size-10 text-icon-emoji leading-none",
  peek: "size-6 text-icon-emoji-sm leading-none",
  picker: "size-5 text-icon-emoji-sm leading-none",
  "picker-grid": "text-icon-emoji-sm leading-none",
};

export function taskIconDisplayClass(
  style: TaskIconStyle | undefined,
  size: TaskIconDisplaySize,
): string {
  return style === "emoji"
    ? EMOJI_SIZE_CLASS[size]
    : PLAIN_SIZE_CLASS[size];
}
