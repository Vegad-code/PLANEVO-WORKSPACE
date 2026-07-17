"use client";

import type { PageTreeItem } from "@/lib/queries/workspace-shell";
import { PageTreeDnd } from "@/features/shell/sidebar/page-tree-dnd";
import { WorkspaceNavGroup } from "@/features/shell/sidebar/workspace-nav-group";

type WorkspaceTreeSectionProps = {
  pages: PageTreeItem[];
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
};

export function WorkspaceTreeSection({
  pages,
  expanded,
  onToggle,
  onNavigate,
}: WorkspaceTreeSectionProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 pb-2">
      <WorkspaceNavGroup
        expanded={expanded}
        onToggle={onToggle}
        onNavigate={onNavigate}
      />
      {expanded && (
        <nav
          id="workspace-page-tree"
          aria-label="Workspace pages"
          className="mt-1 flex flex-col gap-0.5"
          data-testid="workspace-page-tree"
        >
          <PageTreeDnd pages={pages} onNavigate={onNavigate} />
        </nav>
      )}
    </div>
  );
}
