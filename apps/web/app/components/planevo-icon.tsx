import {
  Calendar,
  ChatBubble,
  Folder,
  Home,
  Menu,
  NavArrowDown,
  Network,
  Page,
  Pin,
  Search,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  TaskList,
  Xmark,
} from "iconoir-react";

export type IconName =
  | "workspace"
  | "tasks"
  | "calendar"
  | "files"
  | "page"
  | "ai"
  | "agents"
  | "settings"
  | "chevron-down"
  | "panel-close"
  | "panel-open"
  | "pin"
  | "ask"
  | "search"
  | "menu"
  | "close";

const ICONS = {
  workspace: Home,
  tasks: TaskList,
  calendar: Calendar,
  files: Folder,
  page: Page,
  ai: ChatBubble,
  agents: Network,
  settings: Settings,
  "chevron-down": NavArrowDown,
  "panel-close": SidebarCollapse,
  "panel-open": SidebarExpand,
  pin: Pin,
  ask: ChatBubble,
  search: Search,
  menu: Menu,
  close: Xmark,
} satisfies Record<IconName, typeof Home>;

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const IconComponent = ICONS[name];

  return (
    <IconComponent
      aria-hidden="true"
      className={className}
      strokeWidth={1.5}
    />
  );
}
