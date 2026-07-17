import { Icon, type IconName } from "@/components/ui/planevo-icon";
import { createDatabaseFromTemplate } from "./actions";

const DATABASE_OPTIONS = [
  {
    type: "task",
    name: "Tasks",
    icon: "tasks" as IconName,
    description: "Board, list, and calendar with status, due dates, and priority.",
  },
  {
    type: "notes",
    name: "Notes",
    icon: "page" as IconName,
    description: "Tags and created date with list and table views.",
  },
  {
    type: "project",
    name: "Projects",
    icon: "workspace" as IconName,
    description: "Status, owner, timeline, and linked tasks.",
  },
  {
    type: "files",
    name: "Files",
    icon: "files" as IconName,
    description: "Type, tags, added date, and relations.",
  },
  {
    type: "custom",
    name: "Blank",
    icon: "document" as IconName,
    description: "A name column and table view. Build from there.",
  },
] as const;

export default function TemplatesPage() {
  return (
    <div className="mx-auto min-h-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-label uppercase text-text-muted">New database</p>
      <h1 className="mt-2 text-h1">Choose a starting point</h1>
      <p className="mt-2 max-w-2xl text-body text-text-secondary">
        Every database is born with views and properties. Delete what you do not need.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DATABASE_OPTIONS.map((option) => (
          <form key={option.type} action={createDatabaseFromTemplate.bind(null, option.type)}>
            <button
              type="submit"
              className="flex w-full items-start gap-4 rounded-xl border border-border bg-surface-raised p-4 text-left outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary">
                <Icon name={option.icon} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-body font-medium">{option.name}</span>
                <span className="mt-1 block text-small text-text-secondary">
                  {option.description}
                </span>
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
