import { type SelectOption } from "./database-templates.ts";
import {
  ONBOARDING_TASK_KEYS,
  ONBOARDING_TASK_TITLES,
  GETTING_STARTED_PAGE_ICON,
  GETTING_STARTED_PAGE_TITLE,
  buildGettingStartedContent,
  buildNotesStarterContent,
} from "./getting-started-content.ts";

export type OrganizingAnswer = "work" | "personal" | "school" | "other";

export const ORGANIZING_ANSWERS: OrganizingAnswer[] = [
  "work",
  "personal",
  "school",
  "other",
];

export type StarterWorkspaceConfig = {
  organizing: OrganizingAnswer;
  workspaceIcon: string;
  workspaceNameSuffix: string;
  cardLabel: string;
  cardDescription: string;
  taskStatusOptions: SelectOption[];
  /** Last status option name used as "done" for onboarding tasks. */
  doneStatusName: string;
  /** First status option — default for new/onboarding tasks. */
  defaultStatusName: string;
};

const STARTER_CONFIGS: Record<OrganizingAnswer, StarterWorkspaceConfig> = {
  work: {
    organizing: "work",
    workspaceIcon: "💼",
    workspaceNameSuffix: "Work Workspace",
    cardLabel: "Work",
    cardDescription: "Track projects, company goals, meeting notes",
    taskStatusOptions: [
      { name: "Backlog", color: "slate" },
      { name: "In progress", color: "marigold" },
      { name: "Done", color: "meadow" },
    ],
    doneStatusName: "Done",
    defaultStatusName: "Backlog",
  },
  personal: {
    organizing: "personal",
    workspaceIcon: "🏠",
    workspaceNameSuffix: "Personal Workspace",
    cardLabel: "Personal",
    cardDescription: "Write better, think more clearly, stay organized",
    taskStatusOptions: [
      { name: "To do", color: "slate" },
      { name: "Doing", color: "marigold" },
      { name: "Done", color: "meadow" },
    ],
    doneStatusName: "Done",
    defaultStatusName: "To do",
  },
  school: {
    organizing: "school",
    workspaceIcon: "🎓",
    workspaceNameSuffix: "School Workspace",
    cardLabel: "School",
    cardDescription: "Keep notes, research, and tasks in one place",
    taskStatusOptions: [
      { name: "Assignments", color: "slate" },
      { name: "Exams", color: "marigold" },
      { name: "Readings", color: "meadow" },
    ],
    doneStatusName: "Readings",
    defaultStatusName: "Assignments",
  },
  other: {
    organizing: "other",
    workspaceIcon: "✨",
    workspaceNameSuffix: "Workspace",
    cardLabel: "Something else",
    cardDescription: "Start with a flexible workspace you can reshape anytime",
    taskStatusOptions: [
      { name: "Not started", color: "slate" },
      { name: "In progress", color: "marigold" },
      { name: "Done", color: "meadow" },
    ],
    doneStatusName: "Done",
    defaultStatusName: "Not started",
  },
};

export function isOrganizingAnswer(value: unknown): value is OrganizingAnswer {
  return (
    typeof value === "string" &&
    (ORGANIZING_ANSWERS as string[]).includes(value)
  );
}

export function getStarterWorkspaceConfig(
  organizing: OrganizingAnswer,
): StarterWorkspaceConfig {
  return STARTER_CONFIGS[organizing];
}

/** Derive workspace display name from the user's first name + routing answer. */
export function buildWorkspaceName(
  displayName: string | null | undefined,
  organizing: OrganizingAnswer,
): string {
  const config = getStarterWorkspaceConfig(organizing);
  const first = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .find((part) => part.length > 0);
  if (!first) return `My ${config.workspaceNameSuffix}`;
  return `${first}'s ${config.workspaceNameSuffix}`;
}

export type StarterSeedPayload = {
  organizing: OrganizingAnswer;
  workspaceName: string;
  workspaceIcon: string;
  gettingStarted: {
    title: string;
    icon: string;
    content: unknown[];
  };
  notes: {
    title: string;
    icon: string;
    content: unknown[];
  };
};

/**
 * Full seed payload for create_starter_workspace (client builds JSON; RPC inserts).
 * Pages + getting-started checklist only — no product databases (task/calendar/files
 * are global products seeded separately, see product-defaults.ts).
 */
export function buildStarterSeedPayload(
  organizing: OrganizingAnswer,
  displayName: string | null | undefined,
): StarterSeedPayload {
  const config = getStarterWorkspaceConfig(organizing);

  return {
    organizing,
    workspaceName: buildWorkspaceName(displayName, organizing),
    workspaceIcon: config.workspaceIcon,
    gettingStarted: {
      title: GETTING_STARTED_PAGE_TITLE,
      icon: GETTING_STARTED_PAGE_ICON,
      content: buildGettingStartedContent({
        dragTaskTitle:
          organizing === "school"
            ? "Move a task across the board"
            : ONBOARDING_TASK_TITLES.drag_to_done,
      }),
    },
    notes: {
      title: "Notes",
      icon: "📝",
      content: buildNotesStarterContent(),
    },
  };
}

export {
  ONBOARDING_TASK_KEYS,
  ONBOARDING_TASK_TITLES,
  GETTING_STARTED_PAGE_TITLE,
  GETTING_STARTED_PAGE_ICON,
  buildGettingStartedContent,
  buildNotesStarterContent,
};
