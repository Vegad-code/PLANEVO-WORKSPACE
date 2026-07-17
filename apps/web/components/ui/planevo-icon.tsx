import type { ComponentType, SVGProps } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpCircleIcon,
  ArrowUpTrayIcon,
  Bars3CenterLeftIcon,
  Bars3Icon,
  BellIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  CloudArrowDownIcon,
  Cog6ToothIcon,
  DocumentIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
  UserPlusIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

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
  workspace: HomeIcon,
  canvas: Squares2X2Icon,
  plus: PlusIcon,
  tasks: ClipboardDocumentListIcon,
  calendar: CalendarIcon,
  files: FolderIcon,
  page: DocumentIcon,
  ai: ChatBubbleLeftRightIcon,
  agents: PuzzlePieceIcon,
  settings: Cog6ToothIcon,
  check: CheckIcon,
  "chevron-down": ChevronDownIcon,
  "panel-close": Bars3CenterLeftIcon,
  "panel-open": WindowIcon,
  pin: MapPinIcon,
  search: MagnifyingGlassIcon,
  inbox: BellIcon,
  menu: Bars3Icon,
  close: XMarkIcon,
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  upload: ArrowUpTrayIcon,
  document: DocumentTextIcon,
  import: CloudArrowDownIcon,
  warning: ExclamationTriangleIcon,
  invite: UserPlusIcon,
  upgrade: ArrowUpCircleIcon,
  logout: ArrowRightOnRectangleIcon,
  mail: EnvelopeIcon,
} satisfies Record<IconName, HeroIcon>;

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const IconComponent = ICONS[name];

  return (
    <IconComponent
      aria-hidden="true"
      className={`${className} stroke-[1.5]`}
    />
  );
}
