import { type OrganizingAnswer } from "./starter-workspaces.ts";

export type { OrganizingAnswer };

export type ProductSeedPayload = {
  calendarName: string;
  starterTasks: Array<{ title: string; status: string }>;
};

export function buildProductSeedPayload(input: {
  organizing: OrganizingAnswer | null;
}): ProductSeedPayload {
  const calendarName = "My Calendar";
  const starterTasks = [
    { title: "Rename this workspace", status: "not_started" },
    { title: "Add your first real task", status: "not_started" },
    { title: "Drag a task to Done", status: "not_started" },
    { title: "Connect Google Calendar", status: "not_started" },
    { title: "Import from Notion", status: "not_started" },
  ];
  if (input.organizing === "school") {
    starterTasks[2] = { title: "Move a task across the board", status: "not_started" };
  }
  return { calendarName, starterTasks };
}
