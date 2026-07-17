/**
 * BlockNote-compatible JSON for the seeded Getting Started page (F-45).
 * Stored verbatim in pages.content_json.
 */

export const ONBOARDING_TASK_KEYS = [
  "rename_workspace",
  "add_first_task",
  "drag_to_done",
  "connect_calendar",
  "import_notes",
] as const;

export type OnboardingTaskKey = (typeof ONBOARDING_TASK_KEYS)[number];

export const ONBOARDING_TASK_TITLES: Record<OnboardingTaskKey, string> = {
  rename_workspace: "Rename this workspace",
  add_first_task: "Add your first real task",
  drag_to_done: "Drag it to Done",
  connect_calendar: "Connect Google Calendar",
  import_notes: "Import your existing notes",
};

export const GETTING_STARTED_PAGE_TITLE = "Getting Started";
export const GETTING_STARTED_PAGE_ICON = "👋";

/** Minimal BlockNote document: heading, checklists, tip, toggle. */
export function buildGettingStartedContent(options?: {
  dragTaskTitle?: string;
}): unknown[] {
  const dragTitle =
    options?.dragTaskTitle ?? ONBOARDING_TASK_TITLES.drag_to_done;
  return [
    {
      id: "gs-intro",
      type: "paragraph",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: "Welcome to Planevo. Check these off as you go — they are real tasks on your board too.",
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-check-account",
      type: "checkListItem",
      props: {
        checked: true,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: "Create your Planevo account",
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-check-rename",
      type: "checkListItem",
      props: {
        checked: false,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: ONBOARDING_TASK_TITLES.rename_workspace,
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-check-add",
      type: "checkListItem",
      props: {
        checked: false,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: ONBOARDING_TASK_TITLES.add_first_task,
          styles: {},
        },
      ],
      children: [
        {
          id: "gs-tip-slash",
          type: "bulletListItem",
          props: {
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
          },
          content: [
            {
              type: "text",
              text: "Type /page to add a new page anywhere in the editor.",
              styles: {},
            },
          ],
          children: [],
        },
      ],
    },
    {
      id: "gs-check-drag",
      type: "checkListItem",
      props: {
        checked: false,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: dragTitle,
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-check-calendar",
      type: "checkListItem",
      props: {
        checked: false,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: ONBOARDING_TASK_TITLES.connect_calendar,
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-check-import",
      type: "checkListItem",
      props: {
        checked: false,
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: ONBOARDING_TASK_TITLES.import_notes,
          styles: {},
        },
      ],
      children: [],
    },
    {
      id: "gs-toggle",
      type: "toggleListItem",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: "A few more useful tips",
          styles: {},
        },
      ],
      children: [
        {
          id: "gs-tip-cmdk",
          type: "bulletListItem",
          props: {
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
          },
          content: [
            {
              type: "text",
              text: "Press ⌘K anytime to search or capture a task.",
              styles: {},
            },
          ],
          children: [],
        },
        {
          id: "gs-tip-promote",
          type: "bulletListItem",
          props: {
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
          },
          content: [
            {
              type: "text",
              text: "Select a list of lines and turn them into database records.",
              styles: {},
            },
          ],
          children: [],
        },
      ],
    },
  ];
}

export function buildNotesStarterContent(): unknown[] {
  return [
    {
      id: "notes-intro",
      type: "paragraph",
      props: {
        textColor: "default",
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: [
        {
          type: "text",
          text: "A quiet place for notes. Type / to insert blocks, or select lines to turn into records.",
          styles: {},
        },
      ],
      children: [],
    },
  ];
}
