import type { TaskIconDefinition } from "./task-icon-types.ts";

export const TASK_ICON_REGISTRY = [
  {
    id: "default",
    label: "Default",
    library: "phosphor",
    name: "FolderSimple",
  },
  {
    id: "product",
    label: "Product",
    library: "phosphor",
    name: "RocketLaunch",
  },
  {
    id: "design",
    label: "Design",
    library: "phosphor",
    name: "PaintBrush",
  },
  {
    id: "components",
    label: "Components",
    library: "phosphor",
    name: "Cube",
  },
  {
    id: "user",
    label: "User",
    library: "phosphor",
    name: "User",
  },
  {
    id: "other",
    label: "Other",
    library: "phosphor",
    name: "SquaresFour",
  },
  {
    id: "bug",
    label: "Bug",
    library: "phosphor",
    name: "Bug",
  },
  {
    id: "meeting",
    label: "Meeting",
    library: "phosphor",
    name: "UsersThree",
  },
  {
    id: "docs",
    label: "Docs",
    library: "fontawesome",
    name: "faFileLines",
  },
  {
    id: "research",
    label: "Research",
    library: "phosphor",
    name: "MagnifyingGlass",
  },
  {
    id: "ops",
    label: "Ops",
    library: "phosphor",
    name: "Gear",
  },
  {
    id: "content",
    label: "Content",
    library: "phosphor",
    name: "PencilSimple",
  },
  {
    id: "files",
    label: "Files",
    library: "phosphor",
    name: "Folders",
  },
] as const satisfies readonly TaskIconDefinition[];

export type TaskIconId = (typeof TASK_ICON_REGISTRY)[number]["id"];

export const TASK_ICON_IDS = TASK_ICON_REGISTRY.map(
  (entry) => entry.id,
) as TaskIconId[];

const REGISTRY_BY_ID = new Map<string, TaskIconDefinition>(
  TASK_ICON_REGISTRY.map((entry) => [entry.id, entry]),
);

export function getTaskIconDefinition(id: string): TaskIconDefinition | null {
  return REGISTRY_BY_ID.get(id) ?? null;
}

export function isValidTaskIconId(id: string): id is TaskIconId {
  return REGISTRY_BY_ID.has(id);
}
