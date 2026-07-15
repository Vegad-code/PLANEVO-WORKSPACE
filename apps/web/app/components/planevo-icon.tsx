import {
  Calendar,
  ChatBubble,
  Check,
  CloudDownload,
  EmptyPage,
  Folder,
  Home,
  Menu,
  NavArrowLeft,
  NavArrowDown,
  NavArrowRight,
  Network,
  Page,
  Pin,
  Search,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  TaskList,
  Upload,
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
  | "check"
  | "chevron-down"
  | "panel-close"
  | "panel-open"
  | "pin"
  | "ask"
  | "search"
  | "menu"
  | "close"
  | "arrow-left"
  | "arrow-right"
  | "upload"
  | "document"
  | "import";

const ICONS = {
  workspace: Home,
  tasks: TaskList,
  calendar: Calendar,
  files: Folder,
  page: Page,
  ai: ChatBubble,
  agents: Network,
  settings: Settings,
  check: Check,
  "chevron-down": NavArrowDown,
  "panel-close": SidebarCollapse,
  "panel-open": SidebarExpand,
  pin: Pin,
  ask: ChatBubble,
  search: Search,
  menu: Menu,
  close: Xmark,
  "arrow-left": NavArrowLeft,
  "arrow-right": NavArrowRight,
  upload: Upload,
  document: EmptyPage,
  import: CloudDownload,
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
