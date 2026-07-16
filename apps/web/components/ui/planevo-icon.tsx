import {
  ArrowUpCircle,
  Bell,
  Calendar,
  ChatBubble,
  Check,
  CloudDownload,
  EmptyPage,
  Folder,
  Home,
  LogOut,
  Mail,
  Menu,
  NavArrowLeft,
  NavArrowDown,
  NavArrowRight,
  Network,
  Page,
  Pin,
  Plus,
  Search,
  Settings,
  SidebarCollapse,
  SidebarExpand,
  TaskList,
  Upload,
  UserPlus,
  ViewGrid,
  WarningTriangle,
  Xmark,
} from "iconoir-react";

export type IconName =
  | "workspace"
  | "canvas"
  | "plus"
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
  | "search"
  | "inbox"
  | "menu"
  | "close"
  | "arrow-left"
  | "arrow-right"
  | "upload"
  | "document"
  | "import"
  | "warning"
  | "invite"
  | "upgrade"
  | "logout"
  | "mail";

const ICONS = {
  workspace: Home,
  canvas: ViewGrid,
  plus: Plus,
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
  search: Search,
  inbox: Bell,
  menu: Menu,
  close: Xmark,
  "arrow-left": NavArrowLeft,
  "arrow-right": NavArrowRight,
  upload: Upload,
  document: EmptyPage,
  import: CloudDownload,
  warning: WarningTriangle,
  invite: UserPlus,
  upgrade: ArrowUpCircle,
  logout: LogOut,
  mail: Mail,
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
