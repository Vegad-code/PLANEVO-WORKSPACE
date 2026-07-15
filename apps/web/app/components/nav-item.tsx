"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./planevo-icon";
import { isNavItemActive } from "./navigation-state";

export type NavItemState = "default" | "hover" | "active" | "ai";

type NavItemBaseProps = {
  icon: IconName;
  label: string;
  variant?: "default" | "ai";
  state?: NavItemState;
  compact?: boolean;
  depth?: number;
  onNavigate?: () => void;
};

type NavItemProps = NavItemBaseProps &
  (
    | { href: string; onClick?: never }
    | { href?: never; onClick?: () => void }
  );

const depthClasses = ["", "pl-5", "pl-8"] as const;

function clampDepth(depth: number): 0 | 1 | 2 {
  if (depth <= 0) return 0;
  if (depth === 1) return 1;
  return 2;
}

export function NavItem({
  href,
  onClick,
  icon,
  label,
  variant = "default",
  state,
  compact = false,
  depth = 0,
  onNavigate,
}: NavItemProps) {
  const pathname = usePathname();
  const active = href ? isNavItemActive(pathname, href) : false;
  const resolvedState = state ?? (active ? "active" : variant === "ai" ? "ai" : "default");
  const raised = resolvedState === "hover" || resolvedState === "active";
  const ai = resolvedState === "ai" || variant === "ai";

  const nestedDepth = clampDepth(depth);
  const className = `relative flex h-9 items-center rounded-lg text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
    compact ? "mx-auto w-9 justify-center" : `mx-2 gap-3 px-3 ${depthClasses[nestedDepth]}`
  } ${
    raised
      ? "bg-surface-raised text-ink"
      : ai
        ? "text-ink hover:bg-slate-tint"
        : "text-text-secondary hover:bg-surface-raised hover:text-ink"
  }`;
  const content = (
    <>
      {resolvedState === "active" && (
        <span className="absolute left-0 h-4 w-0.5 bg-marigold" aria-hidden="true" />
      )}
      <Icon name={icon} className={`size-4 shrink-0 ${ai ? "text-slate" : "text-current"}`} />
      {!compact && <span className="min-w-0 truncate">{label}</span>}
    </>
  );

  if (!href) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        className={`${className} text-left`}
        data-nav-state={resolvedState}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      aria-current={resolvedState === "active" ? "page" : undefined}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={className}
      data-nav-state={resolvedState}
    >
      {content}
    </Link>
  );
}
