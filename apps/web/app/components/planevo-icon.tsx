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
  | "ask";

export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    workspace: (
      <>
        <path d="M4.5 5.5h15v13h-15z" />
        <path d="M8 5.5V3.75h8v1.75M8 9.5h8M8 13h5" />
      </>
    ),
    tasks: <path d="m5 7 1.5 1.5L9 5.5M11 7h8M5 13l1.5 1.5L9 11.5M11 13h8M5 19l1.5 1.5L9 17.5M11 19h8" />,
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </>
    ),
    files: (
      <>
        <path d="M4.5 4.5h6l2 2h7v13h-15z" />
        <path d="M4.5 9.5h15" />
      </>
    ),
    page: (
      <>
        <path d="M6 3.5h8l4 4v13H6z" />
        <path d="M14 3.5v4h4M9 12h6M9 16h5" />
      </>
    ),
    ai: (
      <>
        <path d="M7 5.5h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 3v-3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" />
        <path d="M8 11.5h8M8 14.5h5" />
      </>
    ),
    agents: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7l-2 .7v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7l2-.7z" />
      </>
    ),
    "chevron-down": <path d="m7 9.5 5 5 5-5" />,
    "panel-close": (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
        <path d="M9 4v16m6-11-3 3 3 3" />
      </>
    ),
    "panel-open": (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
        <path d="M9 4v16m3-11 3 3-3 3" />
      </>
    ),
    pin: <path d="m8 4 8 8M13 3l8 8-3 1-4 4-1 3-8-8 3-1 4-4zM4 20l5-5" />,
    ask: (
      <>
        <path d="M7 5.5h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-4 3v-3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" />
        <path d="M9 11.5h6M9 14.5h3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
